import {
  holdsSocket,
  shouldPoll,
  transition,
  type CloseVerdict,
  type ConnectionEvent,
  type ConnectionState,
  type SessionResult,
} from "./connection-state";
import { reconnectDelay } from "./reconnect-delay";

// Cloudflare closes idle WebSocket connections after 100 seconds of no
// traffic, so a lightweight ping goes out every 30 seconds.
const PING_EVERY_MS = 30_000;
const STABLE_AFTER_MS = 30_000;
const SESSION_CHECK_TIMEOUT_MS = 10_000;

export interface SocketHandle {
  /** True while this socket is the driver's socket and the connection lives. */
  isCurrent(): boolean;
}

export interface ConnectionOptions<R extends string> {
  url: string;
  classifyClose(
    code: number | undefined,
    reason: string | undefined,
  ): CloseVerdict<R>;
  /** Called after close 4001. A rejection or a timeout counts as "unknown". */
  checkSession(signal: AbortSignal): Promise<SessionResult>;
  /** `reconnect` is true when this connection has opened before. */
  onOpen(info: { reconnect: boolean }): void;
  onMessage(data: string, socket: SocketHandle): void;
  /** Runs after every state change, once the driver has applied it. */
  onState(state: ConnectionState<R>, previous: ConnectionState<R>): void;
  /** Runs while `shouldPoll(state)` holds: not live, not ended, 5+ failures. */
  poll?: { everyMs: number; run: () => void };
  random?: () => number;
}

export interface Connection<R extends string> {
  state(): ConnectionState<R>;
  /** The driver's socket while it holds one (connecting, open or stable). */
  socket(): SocketHandle | null;
  end(reason: R): void;
  dispose(): void;
}

/**
 * Owns one socket at a time, one lifecycle timer (retry or stable), the ping
 * and poll intervals, and the `online` and `visibilitychange` listeners. All
 * of them follow `ConnectionState`; `ended` releases every one.
 */
export function createConnection<R extends string>(
  options: ConnectionOptions<R>,
): Connection<R> {
  const random = options.random ?? (() => Math.random());
  let state: ConnectionState<R> = { status: "connecting", failures: 0 };
  let ws: WebSocket | null = null;
  let handle: SocketHandle | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let hasOpened = false;

  function dispatch(event: ConnectionEvent<R>) {
    const previous = state;
    const next = transition(previous, event);
    if (next === previous) return;
    state = next;
    apply(next);
    options.onState(next, previous);
  }

  function apply(next: ConnectionState<R>) {
    // Every change that reaches here changes what the timer is for.
    clearTimer();
    if (!holdsSocket(next)) releaseSocket();
    switch (next.status) {
      case "connecting":
        openSocket();
        break;
      case "open":
        startPing();
        timer = setTimeout(() => {
          timer = null;
          dispatch({ type: "stable" });
        }, STABLE_AFTER_MS);
        break;
      case "stable":
        // The stable timer fired; the ping keeps running.
        break;
      case "waiting":
        timer = setTimeout(
          () => {
            timer = null;
            dispatch({ type: "retry-due" });
          },
          // A hurried wait restarts with the first-retry delay.
          reconnectDelay(next.hurried ? 1 : next.failures, random),
        );
        break;
      case "checking":
        runSessionCheck(next);
        break;
      case "ended":
        removeListeners();
        break;
    }
    syncPoll(next);
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function openSocket() {
    const socket = new WebSocket(options.url);
    ws = socket;
    const current: SocketHandle = {
      isCurrent: () => ws === socket && state.status !== "ended",
    };
    handle = current;

    socket.onopen = () => {
      if (ws !== socket) return;
      const before = state;
      dispatch({ type: "opened" });
      if (state === before) return;
      const reconnect = hasOpened;
      hasOpened = true;
      options.onOpen({ reconnect });
    };
    socket.onmessage = (event) => {
      if (!current.isCurrent()) return;
      options.onMessage(event.data as string, current);
    };
    socket.onclose = (event) => {
      if (ws !== socket) return;
      // The socket is closed already: drop it so release does not close again.
      ws = null;
      handle = null;
      dispatch({
        type: "closed",
        verdict: options.classifyClose(event?.code, event?.reason),
      });
    };
  }

  function releaseSocket() {
    if (ping !== null) clearInterval(ping);
    ping = null;
    const socket = ws;
    ws = null;
    handle = null;
    socket?.close();
  }

  function startPing() {
    const socket = ws;
    if (ping !== null) clearInterval(ping);
    ping = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "ping" }));
    }, PING_EVERY_MS);
  }

  function runSessionCheck(checking: ConnectionState<R>) {
    const signal = AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS);
    const timedOut = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
    void Promise.race([options.checkSession(signal), timedOut])
      .catch((): SessionResult => "unknown")
      .then((result) => {
        // A later state (ended, say) makes this result stale.
        if (state !== checking) return;
        dispatch({ type: "session", result });
      });
  }

  function syncPoll(next: ConnectionState<R>) {
    const wanted = options.poll !== undefined && shouldPoll(next);
    if (wanted && pollTimer === null && options.poll)
      pollTimer = setInterval(options.poll.run, options.poll.everyMs);
    else if (!wanted && pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function onOnline() {
    dispatch({ type: "wake" });
  }
  function onVisibility() {
    if (document.visibilityState === "visible") dispatch({ type: "wake" });
  }
  function removeListeners() {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
  }

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  openSocket();

  return {
    state: () => state,
    socket: () => handle,
    end: (reason) => dispatch({ type: "end", reason }),
    dispose: () => dispatch({ type: "end", reason: "disposed" }),
  };
}
