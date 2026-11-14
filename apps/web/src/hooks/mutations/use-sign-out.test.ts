import { cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { handleUnauthorized } from "@/lib/http-error";
import { signOutState } from "@/lib/sign-out-state";
import useSignOut from "./use-sign-out";

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  navigate: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  drain: vi.fn(),
  clear: vi.fn(),
  clearQueries: vi.fn(),
  clearMutations: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ mutationFn }: { mutationFn: () => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
  }),
  useQueryClient: () => ({
    removeQueries: m.clearQueries,
    getMutationCache: () => ({ clear: m.clearMutations }),
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user" } } }),
    signOut: m.signOut,
  },
}));
vi.mock("@/lib/description-save-queue", () => ({
  descriptionSaveQueue: { pause: m.pause, drain: m.drain, clear: m.clear },
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

const location = {
  origin: "https://baton.example.test",
  pathname: "/dashboard",
  search: "",
  hash: "",
  href: "https://baton.example.test/dashboard",
  replace: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  signOutState.isRedirecting = false;
  location.href = "https://baton.example.test/dashboard";
  vi.stubGlobal("window", { location });
  m.pause.mockReturnValue(m.resume);
  m.drain.mockResolvedValue(true);
  m.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

afterEach(() => {
  cleanup();
  signOutState.isRedirecting = false;
  vi.unstubAllGlobals();
});

describe("sign-out", () => {
  it.each(["response", "network"])(
    "restores ordinary unauthorized navigation after a %s failure",
    async (failure) => {
      if (failure === "response") {
        m.signOut.mockResolvedValue({ error: { message: "Sign-out failed" } });
      } else {
        m.signOut.mockRejectedValue(new Error("Sign-out failed"));
      }

      const { result } = renderHook(() => useSignOut());
      await expect(result.current.mutateAsync()).rejects.toThrow(
        "Sign-out failed",
      );

      expect(signOutState.isRedirecting).toBe(false);
      expect(m.clear).not.toHaveBeenCalled();
      expect(m.resume).toHaveBeenCalledTimes(1);
      handleUnauthorized();
      expect(location.replace).toHaveBeenCalledWith(
        "/auth/sign-in?redirect=%2Fdashboard",
      );
    },
  );

  it("keeps local-only sign-out and unauthorized navigation working", async () => {
    const { result } = renderHook(() => useSignOut());
    await result.current.mutateAsync();

    expect(m.navigate).toHaveBeenCalledWith({
      to: "/auth/sign-in",
      replace: true,
    });
    expect(signOutState.isRedirecting).toBe(false);
    handleUnauthorized();
    expect(location.replace).toHaveBeenCalledTimes(1);
  });

  it("leaves the app before ending a local session and returns on failure", async () => {
    m.signOut.mockImplementation(async () => {
      expect(m.navigate).toHaveBeenCalledWith({
        to: "/auth/sign-in",
        replace: true,
      });
      expect(signOutState.isRedirecting).toBe(true);
      handleUnauthorized();
      return { error: { message: "Sign-out failed" } };
    });

    const { result } = renderHook(() => useSignOut());
    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Sign-out failed",
    );

    expect(location.replace).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenLastCalledWith({
      href: "/dashboard",
      replace: true,
    });
    expect(signOutState.isRedirecting).toBe(false);
  });

  it("does not end the session when pending edits cannot be saved", async () => {
    m.drain.mockResolvedValue(false);

    const { result } = renderHook(() => useSignOut());
    await expect(result.current.mutateAsync()).rejects.toThrow(
      "tasks:detail.editor.saveFailed",
    );

    expect(m.signOut).not.toHaveBeenCalled();
    expect(signOutState.isRedirecting).toBe(false);
    expect(m.resume).toHaveBeenCalledTimes(1);
  });

  it("does not clear the query cache when pending edits cannot be saved", async () => {
    m.drain.mockResolvedValue(false);

    const { result } = renderHook(() => useSignOut());
    await expect(result.current.mutateAsync()).rejects.toThrow();

    expect(m.clearQueries).not.toHaveBeenCalled();
  });

  it("does not clear the query cache when sign-out returns an error", async () => {
    m.signOut.mockResolvedValue({ error: { message: "Sign-out failed" } });

    const { result } = renderHook(() => useSignOut());
    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Sign-out failed",
    );

    expect(m.clearQueries).not.toHaveBeenCalled();
  });
});

describe("query cache cleanup on sign-out", () => {
  it("drops user data once the local session has ended", async () => {
    m.signOut.mockImplementation(async () => {
      expect(m.navigate).toHaveBeenCalledWith({
        to: "/auth/sign-in",
        replace: true,
      });
      expect(m.clearQueries).not.toHaveBeenCalled();
      return { data: { success: true }, error: null };
    });

    const { result } = renderHook(() => useSignOut());
    await result.current.mutateAsync();

    expect(m.clearQueries).toHaveBeenCalledTimes(1);
    expect(m.clearMutations).toHaveBeenCalledTimes(1);
    expect(m.clear.mock.invocationCallOrder[0]).toBeLessThan(
      m.clearQueries.mock.invocationCallOrder[0],
    );
  });

  it("keeps the config and instance status the auth pages reuse", async () => {
    const { result } = renderHook(() => useSignOut());
    await result.current.mutateAsync();

    const { predicate } = m.clearQueries.mock.calls[0][0] as {
      predicate: (query: { queryKey: unknown[] }) => boolean;
    };
    expect(predicate({ queryKey: ["config"] })).toBe(false);
    expect(predicate({ queryKey: ["instance-status"] })).toBe(false);
    expect(predicate({ queryKey: ["tasks", "project-1"] })).toBe(true);
  });
});
