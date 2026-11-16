import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createConnection, type ConnectionOptions } from "./create-connection";
import type { SessionResult } from "./connection-state";

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event?: { code?: number; reason?: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });
  constructor(public url: string) {
    TestSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const last = () => TestSocket.instances.at(-1)!;
const open: { dispose(): void }[] = [];

function setup(overrides: Partial<ConnectionOptions<"revoked">> = {}) {
  const options = {
    url: "ws://test",
    classifyClose: (code?: number) =>
      code === 4001
        ? ("check-session" as const)
        : code === 1008
          ? { end: "revoked" as const }
          : ("retry" as const),
    checkSession: vi.fn((): Promise<SessionResult> => Promise.resolve("same")),
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onState: vi.fn(),
    random: () => 0.5,
    ...overrides,
  } satisfies ConnectionOptions<"revoked">;
  const connection = createConnection(options);
  open.push(connection);
  return { options, connection };
}

describe("createConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", TestSocket);
    TestSocket.instances = [];
  });
  afterEach(() => {
    // A leaked connection would keep its window listeners for the next test.
    for (const connection of open.splice(0)) connection.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens one socket and reports reconnects only after a first open", () => {
    const { options } = setup();
    expect(TestSocket.instances).toHaveLength(1);
    last().open();
    expect(options.onOpen).toHaveBeenLastCalledWith({ reconnect: false });
    last().onclose?.();
    vi.advanceTimersByTime(750);
    last().open();
    expect(options.onOpen).toHaveBeenLastCalledWith({ reconnect: true });
  });

  it("waits a jittered, growing delay between attempts", () => {
    setup();
    for (const [index, delay] of [750, 1250, 2250].entries()) {
      last().onclose?.();
      vi.advanceTimersByTime(delay - 1);
      expect(TestSocket.instances).toHaveLength(index + 1);
      vi.advanceTimersByTime(1);
      expect(TestSocket.instances).toHaveLength(index + 2);
    }
  });

  it("forgets failures only after 30 s open", () => {
    setup();
    last().onclose?.();
    vi.advanceTimersByTime(750);
    last().open();
    vi.advanceTimersByTime(29_999);
    last().onclose?.(); // failures 2: 1250 ms
    vi.advanceTimersByTime(1249);
    expect(TestSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(TestSocket.instances).toHaveLength(3);
    last().open();
    vi.advanceTimersByTime(30_000);
    last().onclose?.(); // failures 1 again: 750 ms
    vi.advanceTimersByTime(750);
    expect(TestSocket.instances).toHaveLength(4);
  });

  it("only sends pings on an open socket", () => {
    setup();
    last().open();
    vi.advanceTimersByTime(30_000);
    expect(last().send).toHaveBeenCalledWith('{"type":"ping"}');
  });

  describe("wake", () => {
    it("online while waiting connects within a second", () => {
      setup();
      for (let i = 0; i < 4; i++) {
        last().onclose?.();
        vi.advanceTimersByTime(30_000);
      }
      last().onclose?.(); // failures 5: 8250 ms
      expect(TestSocket.instances).toHaveLength(5);
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(999);
      expect(TestSocket.instances).toHaveLength(6);
    });

    it("hurries a wait once and keeps failures", () => {
      setup();
      last().onclose?.();
      vi.advanceTimersByTime(750);
      last().onclose?.(); // failures 2: 1250 ms
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(500);
      // A second wake does not re-arm the timer.
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(249);
      expect(TestSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(TestSocket.instances).toHaveLength(3);
      last().onclose?.(); // failures 3 (kept): 2250 ms
      vi.advanceTimersByTime(2249);
      expect(TestSocket.instances).toHaveLength(3);
      vi.advanceTimersByTime(1);
      expect(TestSocket.instances).toHaveLength(4);
    });

    it("wakes on a visible tab but not a hidden one", () => {
      setup();
      last().onclose?.();
      const visibility = vi.spyOn(document, "visibilityState", "get");
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(749);
      expect(TestSocket.instances).toHaveLength(1);
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(750);
      expect(TestSocket.instances).toHaveLength(2);
    });

    it("opens no second socket while connecting, open or checking", async () => {
      const { connection } = setup({
        checkSession: vi.fn(() => new Promise<SessionResult>(() => {})),
      });
      const wake = () => {
        window.dispatchEvent(new Event("online"));
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(5000);
      };
      wake(); // connecting
      expect(TestSocket.instances).toHaveLength(1);
      last().open();
      wake(); // open
      vi.advanceTimersByTime(30_000);
      wake(); // stable
      expect(TestSocket.instances).toHaveLength(1);
      last().onclose?.({ code: 4001 });
      expect(connection.state().status).toBe("checking");
      wake();
      expect(TestSocket.instances).toHaveLength(1);
    });
  });

  describe("poll", () => {
    it("starts once at the fifth failure, runs while degraded and stops on open", () => {
      const run = vi.fn();
      const { connection } = setup({ poll: { everyMs: 30_000, run } });
      for (let i = 0; i < 4; i++) {
        last().onclose?.();
        vi.advanceTimersByTime(30_000);
      }
      vi.advanceTimersByTime(60_000);
      expect(run).not.toHaveBeenCalled();
      last().onclose?.(); // failures 5
      expect(connection.state()).toMatchObject({ failures: 5 });
      vi.advanceTimersByTime(30_000);
      expect(run).toHaveBeenCalledTimes(1);
      expect(TestSocket.instances.length).toBeGreaterThan(5);
      last().onclose?.();
      vi.advanceTimersByTime(30_000);
      expect(run).toHaveBeenCalledTimes(2);
      last().open();
      vi.advanceTimersByTime(20_000);
      expect(run).toHaveBeenCalledTimes(2);
      // Failures were kept: the poll returns at the next close.
      last().onclose?.();
      vi.advanceTimersByTime(30_000);
      expect(run).toHaveBeenCalledTimes(3);
    });

    it("never polls without a poll option", () => {
      setup();
      for (let i = 0; i < 8; i++) {
        last().onclose?.();
        vi.advanceTimersByTime(30_000);
      }
      last().onclose?.();
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe("session check", () => {
    it("reconnects with no wait when the session is the same", async () => {
      setup();
      last().open();
      last().onclose?.({ code: 4001 });
      await vi.advanceTimersByTimeAsync(0);
      expect(TestSocket.instances).toHaveLength(2);
    });

    it("ends when the session is gone", async () => {
      const { connection, options } = setup({
        checkSession: vi.fn(() => Promise.resolve<SessionResult>("gone")),
      });
      last().onclose?.({ code: 4001 });
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.state()).toEqual({
        status: "ended",
        reason: "session-ended",
      });
      expect(options.onState).toHaveBeenLastCalledWith(
        { status: "ended", reason: "session-ended" },
        expect.anything(),
      );
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
      ["rejects", () => Promise.reject(new Error("offline"))],
      ["reports unknown", () => Promise.resolve<SessionResult>("unknown")],
    ])("waits and checks again when the check %s", async (_, check) => {
      const checkSession = vi
        .fn<() => Promise<SessionResult>>(check)
        .mockResolvedValueOnce("unknown");
      checkSession.mockImplementationOnce(check);
      const { connection } = setup({ checkSession });
      last().onclose?.({ code: 4001 });
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.state().status).toBe("waiting");
      expect(TestSocket.instances).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1250);
      expect(checkSession).toHaveBeenCalledTimes(2);
      expect(TestSocket.instances).toHaveLength(1);
    });

    it("re-checks until the session is gone, with growing waits", async () => {
      const checkSession = vi
        .fn<() => Promise<SessionResult>>()
        .mockResolvedValueOnce("unknown")
        .mockResolvedValueOnce("unknown")
        .mockResolvedValueOnce("gone");
      const { connection } = setup({ checkSession });
      last().onclose?.({ code: 4001 });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1249);
      expect(checkSession).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(checkSession).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2249);
      expect(checkSession).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(connection.state()).toEqual({
        status: "ended",
        reason: "session-ended",
      });
      expect(TestSocket.instances).toHaveLength(1);
    });

    it("returns to waiting when the check times out", async () => {
      const abort = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(abort.signal);
      const checkSession = vi.fn(
        (_signal: AbortSignal) => new Promise<SessionResult>(() => {}),
      );
      const { connection } = setup({ checkSession });
      last().onclose?.({ code: 4001 });
      await vi.advanceTimersByTimeAsync(0);
      expect(checkSession).toHaveBeenCalledWith(abort.signal);
      expect(connection.state().status).toBe("checking");
      abort.abort(new Error("timeout"));
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.state().status).toBe("waiting");
    });

    it("opens no socket when the check resolves after dispose", async () => {
      let resolve!: (result: SessionResult) => void;
      const { connection } = setup({
        checkSession: vi.fn(
          () => new Promise<SessionResult>((r) => (resolve = r)),
        ),
      });
      last().onclose?.({ code: 4001 });
      connection.dispose();
      resolve("same");
      await vi.advanceTimersByTimeAsync(0);
      expect(TestSocket.instances).toHaveLength(1);
    });
  });

  describe("ending", () => {
    it("ends on a terminal close and ignores everything after", () => {
      const { connection, options } = setup();
      last().open();
      last().onclose?.({ code: 1008 });
      expect(connection.state()).toEqual({
        status: "ended",
        reason: "revoked",
      });
      expect(options.onState).toHaveBeenLastCalledWith(
        { status: "ended", reason: "revoked" },
        expect.anything(),
      );
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(60_000);
      expect(TestSocket.instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("end() closes the socket once", () => {
      const { connection } = setup();
      last().open();
      connection.end("revoked");
      expect(last().close).toHaveBeenCalledOnce();
      last().onclose?.();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("dispose leaves zero timers and no listeners", () => {
      const add = vi.spyOn(window, "addEventListener");
      const remove = vi.spyOn(window, "removeEventListener");
      const addDoc = vi.spyOn(document, "addEventListener");
      const removeDoc = vi.spyOn(document, "removeEventListener");
      const run = vi.fn();
      const { connection } = setup({ poll: { everyMs: 30_000, run } });
      for (let i = 0; i < 5; i++) {
        last().onclose?.();
        vi.advanceTimersByTime(30_000);
      }
      last().open();
      connection.dispose();
      expect(vi.getTimerCount()).toBe(0);
      expect(remove.mock.calls.map(([type]) => type)).toEqual(
        add.mock.calls.map(([type]) => type),
      );
      expect(removeDoc.mock.calls.map(([type]) => type)).toEqual(
        addDoc.mock.calls.map(([type]) => type),
      );
      expect(last().close).toHaveBeenCalledOnce();
    });

    it("dispose while waiting clears the retry timer", () => {
      const { connection } = setup();
      last().onclose?.();
      expect(vi.getTimerCount()).toBe(1);
      connection.dispose();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60_000);
      expect(TestSocket.instances).toHaveLength(1);
    });
  });

  describe("socket identity", () => {
    it("passes messages only from the current socket", () => {
      const { options, connection } = setup();
      const first = last();
      first.open();
      first.onmessage?.({ data: "one" });
      expect(options.onMessage).toHaveBeenCalledWith("one", expect.anything());
      const handle = connection.socket()!;
      expect(handle.isCurrent()).toBe(true);
      first.onclose?.();
      expect(handle.isCurrent()).toBe(false);
      expect(connection.socket()).toBeNull();
      first.onmessage?.({ data: "late" });
      expect(options.onMessage).toHaveBeenCalledOnce();
    });

    it("treats a socket that has not opened as current", () => {
      const { options, connection } = setup();
      last().onmessage?.({ data: "early" });
      expect(options.onMessage).toHaveBeenCalledWith(
        "early",
        connection.socket(),
      );
    });

    it("ignores a late close from a replaced socket", () => {
      const { connection } = setup();
      const first = last();
      first.onclose?.();
      vi.advanceTimersByTime(750);
      first.onclose?.();
      first.onopen?.();
      expect(connection.state().status).toBe("connecting");
      expect(TestSocket.instances).toHaveLength(2);
    });

    it("loops back off after a server that closes right after open", () => {
      setup();
      const delays = [750, 1250, 2250];
      for (const delay of delays) {
        last().open();
        last().onclose?.({ code: 1011 });
        const count = TestSocket.instances.length;
        vi.advanceTimersByTime(delay - 1);
        expect(TestSocket.instances).toHaveLength(count);
        vi.advanceTimersByTime(1);
        expect(TestSocket.instances).toHaveLength(count + 1);
      }
    });
  });
});
