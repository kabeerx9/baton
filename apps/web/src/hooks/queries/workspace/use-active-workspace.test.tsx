import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import useActiveWorkspace from "./use-active-workspace";

const m = vi.hoisted(() => ({
  routeId: undefined as string | undefined,
  list: [] as { id: string; kind: string }[],
  read: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: ({
    select,
  }: {
    select: (params: Record<string, unknown>) => unknown;
  }) => select(m.routeId ? { workspaceId: m.routeId } : {}),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/fetchers/workspace/get-workspaces", () => ({
  default: () => Promise.resolve(m.list),
}));
vi.mock("@/fetchers/workspace/get-workspace", () => ({
  default: (id: string) => m.read(id),
}));

const KEY = "baton:last-workspace:u1";
const ws = (id: string, kind = "team") => ({
  id,
  name: id,
  kind,
  role: "member",
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  m.routeId = undefined;
  m.list = [ws("a"), ws("b")];
  m.read.mockImplementation((id: string) => Promise.resolve(ws(id)));
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("useActiveWorkspace", () => {
  it("shows the route's workspace, read by id", async () => {
    m.routeId = "b";
    sessionStorage.setItem(KEY, "a");
    const { result } = renderHook(useActiveWorkspace, { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("b"));
    expect(m.read).toHaveBeenCalledWith("b");
    expect(m.read).not.toHaveBeenCalledWith("a");
  });

  it("never stands another workspace in for a refused route id", async () => {
    m.routeId = "x";
    m.read.mockImplementation((id: string) =>
      id === "x"
        ? Promise.reject(new HttpError(404, "gone"))
        : Promise.resolve(ws(id)),
    );
    const { result } = renderHook(useActiveWorkspace, { wrapper });
    await waitFor(() =>
      expect(result.current.state.status).toBe("unavailable"),
    );
    expect(result.current.data).toBeUndefined();
  });

  it("shows this tab's remembered workspace, even one the list leaves out", async () => {
    sessionStorage.setItem(KEY, "demo");
    m.read.mockImplementation((id: string) => Promise.resolve(ws(id, "demo")));
    const { result } = renderHook(useActiveWorkspace, { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("demo"));
  });

  it("forgets a refused remembered workspace and picks the first", async () => {
    sessionStorage.setItem(KEY, "gone");
    localStorage.setItem(KEY, "gone");
    m.read.mockImplementation((id: string) =>
      id === "gone"
        ? Promise.reject(new HttpError(403, "no"))
        : Promise.resolve(ws(id)),
    );
    const { result } = renderHook(useActiveWorkspace, { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("a"));
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("is none, not loading, for a user with no workspace", async () => {
    m.list = [];
    const { result } = renderHook(useActiveWorkspace, { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("none"));
  });
});
