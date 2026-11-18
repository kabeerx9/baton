import { defaultRolePayloads } from "@baton/permissions";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { CustomRoleEditor, PermissionList } from "./roles";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/hooks/mutations/workspace/use-update-workspace-role", () => ({
  default: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/mutations/workspace/use-create-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/workspace/use-delete-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({}),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockResolvedValue({ success: true });
});

describe("workspace role permission editing", () => {
  it("shows role administration, membership and join links in read-only role details", () => {
    render(<PermissionList permissions={defaultRolePayloads.admin} readOnly />);
    for (const label of [
      "Change role permissions",
      "Change member roles",
      "Manage join links",
      "Edit teams",
    ]) {
      expect(screen.getByRole("switch", { name: label })).toBeChecked();
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
  it("can remove every permission, including all provider administrative rights", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "admin",
          permission: defaultRolePayloads.admin,
          createdAt: "2026-11-18T00:00:00.000Z",
          updatedAt: "2026-11-18T00:00:00.000Z",
        }}
        isDefault
        onDelete={() => {}}
      />,
    );
    for (const control of screen.getAllByRole("switch", { checked: true }))
      fireEvent.click(control);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleId: "role",
        permission: {},
      }),
    );
  });
  it("offers delete for a custom role only; a built-in role explains why", () => {
    const role = {
      id: "role",
      workspaceId: "workspace",
      permission: { task: ["read"] },
      createdAt: "2026-11-18T00:00:00.000Z",
      updatedAt: "2026-11-18T00:00:00.000Z",
    };
    const onDelete = vi.fn();
    const view = render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{ ...role, role: "member" }}
        isDefault
        onDelete={onDelete}
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceRoles.deleteRole",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("settings:workspaceRoles.defaultRoleHelp"),
    ).toBeInTheDocument();

    view.rerender(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{ ...role, role: "qa" }}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.deleteRole",
      }),
    );
    expect(onDelete).toHaveBeenCalledOnce();
  });
  it("also exposes unknown stored permission entries instead of silently retaining them", () => {
    render(
      <PermissionList
        permissions={{ extension: ["future-right"] }}
        selected={{ extension: new Set(["future-right"]) }}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "future-right extension" }),
    ).toBeChecked();
  });
});
