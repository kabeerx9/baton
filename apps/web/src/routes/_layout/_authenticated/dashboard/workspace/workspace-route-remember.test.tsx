import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";

const m = vi.hoisted(() => ({ getWorkspace: vi.fn() }));

vi.mock("@/fetchers/workspace/get-workspace", () => ({
  default: m.getWorkspace,
}));
vi.mock("@/components/common/layout", () => ({
  default: () => <div>board layout</div>,
}));
vi.mock("@/components/common/workspace-archived", () => ({
  default: () => <div>archived screen</div>,
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));

import { Route } from "./$workspaceId";

vi.spyOn(Route, "useParams").mockReturnValue({ workspaceId: "B" } as never);

const KEY = "baton:last-workspace:u1";
const Component = Route.options.component as () => React.ReactNode;

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("workspace route", () => {
  it("remembers the workspace for this tab once it reads", async () => {
    m.getWorkspace.mockResolvedValue({ id: "B", role: "member" });
    renderRoute();
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBe("B"));
    expect(localStorage.getItem(KEY)).toBe("B");
  });

  it("shows the archived screen and does not remember it", async () => {
    m.getWorkspace.mockRejectedValue(
      new HttpError(403, "archived", { code: "WORKSPACE_ARCHIVED" }),
    );
    renderRoute();
    expect(await screen.findByText("archived screen")).toBeVisible();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("does not remember a workspace the user is not a member of", async () => {
    m.getWorkspace.mockResolvedValue({ id: "B", role: null });
    renderRoute();
    await waitFor(() => expect(m.getWorkspace).toHaveBeenCalled());
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
