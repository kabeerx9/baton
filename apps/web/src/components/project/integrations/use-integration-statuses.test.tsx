import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useIntegrationStatuses } from "@/components/project/integrations/use-integration-statuses";
const fetchers = vi.hoisted(() => ({
  github: vi.fn(),
}));
vi.mock("@/fetchers/github-integration/get-github-integration", () => ({
  default: fetchers.github,
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const fetcher of Object.values(fetchers))
    fetcher.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  client.clear();
});
describe("useIntegrationStatuses", () => {
  it("reads the integration without a management permission gate", async () => {
    fetchers.github.mockResolvedValue({
      repositoryOwner: "acme",
      repositoryName: "web",
      isActive: true,
    });
    const { result } = renderHook(() => useIntegrationStatuses("p1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.statuses.github).toEqual({
        state: "connected",
        detail: "acme/web",
      }),
    );
    expect(fetchers.github).toHaveBeenCalledWith("p1");
  });
  it("keeps pending requests unknown until configuration arrives", async () => {
    let resolve!: (value: unknown) => void;
    fetchers.github.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useIntegrationStatuses("p1"), {
      wrapper,
    });
    expect(result.current.statuses.github.state).toBe("loading");
    await act(async () => {
      resolve({
        repositoryOwner: "acme",
        repositoryName: "web",
        isActive: true,
      });
    });
    await waitFor(() =>
      expect(result.current.statuses.github).toEqual({
        state: "connected",
        detail: "acme/web",
      }),
    );
  });
  it("retries the failed integration and recovers", async () => {
    fetchers.github
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue(null);
    const { result } = renderHook(() => useIntegrationStatuses("p1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("unavailable"),
    );
    act(() => result.current.retry("github"));
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("disconnected"),
    );
    expect(fetchers.github).toHaveBeenCalledTimes(2);
  });
  it("starts with an unknown status when switching projects", async () => {
    fetchers.github.mockImplementation((projectId: string) =>
      projectId === "p1"
        ? Promise.resolve({
            repositoryOwner: "acme",
            repositoryName: "web",
            isActive: true,
          })
        : new Promise(() => {}),
    );
    const { result, rerender } = renderHook(
      ({ projectId }) => useIntegrationStatuses(projectId),
      { initialProps: { projectId: "p1" }, wrapper },
    );
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("connected"),
    );
    rerender({ projectId: "p2" });
    expect(result.current.statuses.github.state).toBe("loading");
    expect(result.current.statuses.github.detail).toBeUndefined();
  });
  it("shows loading during a delayed retry and reuses the in-flight request", async () => {
    let resolve!: (value: unknown) => void;
    fetchers.github
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
    const { result } = renderHook(() => useIntegrationStatuses("p1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("unavailable"),
    );
    act(() => result.current.retry("github"));
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("loading"),
    );
    act(() => result.current.retry("github"));
    expect(fetchers.github).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolve(null);
    });
    await waitFor(() =>
      expect(result.current.statuses.github.state).toBe("disconnected"),
    );
  });

  it.each([
    {
      data: { repositoryOwner: "acme", repositoryName: "web", isActive: true },
      expected: { state: "connected", detail: "acme/web" },
    },
    {
      data: { repositoryOwner: "acme", repositoryName: "web", isActive: null },
      expected: { state: "paused", detail: "acme/web" },
    },
    { data: null, expected: { state: "disconnected" } },
  ])(
    "keeps the last loaded status after a failed background refresh: $expected.state",
    async ({ data, expected }) => {
      fetchers.github
        .mockResolvedValueOnce(data)
        .mockRejectedValue(new Error("Network unavailable"));
      const { result } = renderHook(() => useIntegrationStatuses("p1"), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.statuses.github).toEqual(expected),
      );
      await act(async () => {
        await client.refetchQueries({ queryKey: ["github-integration", "p1"] });
      });
      expect(client.getQueryState(["github-integration", "p1"])?.status).toBe(
        "error",
      );
      expect(result.current.statuses.github).toEqual(expected);
    },
  );
});
