import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ setActive: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
}));
vi.mock("@/components/common/layout", () => ({ default: () => null }));
vi.mock("@/components/common/workspace-archived", () => ({
  default: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-workspace-archived", () => ({
  default: () => false,
}));

import { Route } from "./$workspaceId";

const enter = (activeId: string | undefined) =>
  (Route.options.beforeLoad as (args: unknown) => Promise<unknown>)({
    params: { workspaceId: "B" },
    context: { session: { session: { activeOrganizationId: activeId } } },
  });

beforeEach(() => vi.clearAllMocks());

describe("workspace route entry", () => {
  it("activates the URL workspace when the session names another", async () => {
    mocks.setActive.mockResolvedValue({ data: {} });
    await enter("A");
    expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "B" });
  });

  it("renders nothing under it when setActive fails", async () => {
    mocks.setActive.mockResolvedValue({ error: { status: 500 } });
    await expect(enter("A")).rejects.toBeInstanceOf(Error);
  });

  it("redirects a non-member to /dashboard", async () => {
    mocks.setActive.mockResolvedValue({
      error: { status: 403, code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION" },
    });
    await expect(enter("A")).rejects.toMatchObject({
      options: { to: "/dashboard" },
    });
  });
});
