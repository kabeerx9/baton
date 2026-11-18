import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { WorkspaceUser } from "@/types/workspace-user";
import MembersTable from "./members-table";

const success = vi.fn();
const error = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => success(msg),
    error: (msg: string) => error(msg),
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/format", () => ({
  formatDateMedium: () => "Sep 1, 2026",
}));

const removeMember = vi.fn();
const updateRole = vi.fn();

vi.mock("@/hooks/mutations/workspace-user/use-delete-workspace-user", () => ({
  default: () => ({ mutateAsync: removeMember, isPending: false }),
}));

vi.mock(
  "@/hooks/mutations/workspace-user/use-update-workspace-user-role",
  () => ({
    default: () => ({ mutateAsync: updateRole }),
  }),
);

vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({ data: [] }),
}));

const updateProjectAccess = vi.fn();

vi.mock(
  "@/hooks/mutations/workspace-user/use-update-member-project-access",
  () => ({
    default: () => ({ mutateAsync: updateProjectAccess, isPending: false }),
  }),
);

vi.mock(
  "@/hooks/queries/workspace-users/use-get-workspace-project-access",
  () => ({
    default: () => ({
      data: [
        {
          userId: "restricted-user",
          projectAccess: "selected",
          projectIds: ["project-a"],
        },
      ],
    }),
  }),
);

const myProjectAccess = vi.fn(() => ({
  projectAccess: "all",
  projectIds: [] as string[],
}));

vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => ({ data: myProjectAccess() }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-a", name: "Alpha" },
      { id: "project-b", name: "Beta" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageTeam: () => true,
    canUpdateMembers: () => true,
    canRemoveMembers: () => true,
  }),
}));

vi.mock("../providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "current-user" } }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeMember(userId: string, role: string, name: string) {
  return {
    id: userId,
    role,
    joinedAt: "2026-09-01T00:00:00.000Z",
    name,
    email: `${userId}@example.com`,
    image: null,
  } satisfies WorkspaceUser;
}

describe("MembersTable project access", () => {
  const members = [
    makeMember("owner-user", "owner", "Olive Owner"),
    makeMember("current-user", "admin", "Casey Current"),
    makeMember("restricted-user", "member", "Riley Restricted"),
    makeMember("open-user", "member", "Avery All"),
  ];

  it("lets managers edit other members' access but not owners or themselves", () => {
    render(<MembersTable workspaceId="workspace-1" users={members} />);

    const editButtons = screen.getAllByRole("button", {
      name: "team:projectAccess.editAria",
    });
    expect(editButtons).toHaveLength(2);
    expect(
      screen.getAllByText("team:projectAccess.projectCount").length,
    ).toBeGreaterThan(0);
  });

  it("lets a limited manager edit only limited members", () => {
    myProjectAccess.mockReturnValue({
      projectAccess: "selected",
      projectIds: ["project-a"],
    });

    render(<MembersTable workspaceId="workspace-1" users={members} />);

    expect(
      screen.getAllByRole("button", { name: "team:projectAccess.editAria" }),
    ).toHaveLength(1);
    myProjectAccess.mockReturnValue({ projectAccess: "all", projectIds: [] });
  });

  it("saves selected projects for a member from the dialog", async () => {
    updateProjectAccess.mockResolvedValue({});

    render(<MembersTable workspaceId="workspace-1" users={[members[2]]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.editAria" }),
    );

    expect(
      await screen.findByText("team:projectAccess.dialogTitle"),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.save" }),
    );

    await waitFor(() =>
      expect(updateProjectAccess).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        userId: "restricted-user",
        projectAccess: "selected",
        projectIds: ["project-a", "project-b"],
      }),
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("team:projectAccess.updateSuccess"),
    );
  });

  it("asks for a project instead of saving an empty selection", async () => {
    render(<MembersTable workspaceId="workspace-1" users={[members[2]]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.editAria" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.save" }),
    );

    expect(
      await screen.findByText("team:projectAccess.selectAtLeastOne"),
    ).toBeVisible();
    expect(updateProjectAccess).not.toHaveBeenCalled();
  });
});

describe("MembersTable removal", () => {
  it("removes a member by user id, not by email", async () => {
    removeMember.mockResolvedValue({});
    render(
      <MembersTable
        workspaceId="workspace-1"
        users={[makeMember("other-user", "member", "Oscar Other")]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.ariaRemoveMember",
      }),
    );
    fireEvent.click(await screen.findByText("team:membersTable.removeMember"));
    const confirm = await screen.findAllByRole("button", {
      name: "team:membersTable.removeMember",
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() =>
      expect(removeMember).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        userId: "other-user",
      }),
    );
    expect(success).toHaveBeenCalledWith("team:membersTable.removeSuccess");
  });

  it("shows the error and keeps the member when removal fails", async () => {
    removeMember.mockRejectedValue(new Error("Only owner"));
    render(
      <MembersTable
        workspaceId="workspace-1"
        users={[makeMember("other-user", "member", "Oscar Other")]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.ariaRemoveMember",
      }),
    );
    fireEvent.click(await screen.findByText("team:membersTable.removeMember"));
    const confirm = await screen.findAllByRole("button", {
      name: "team:membersTable.removeMember",
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(error).toHaveBeenCalledWith("Only owner"));
    expect(screen.getByText("Oscar Other")).toBeVisible();
  });
});

describe("MembersTable role change", () => {
  async function pickRole(name: string) {
    fireEvent.click(
      screen.getByRole("combobox", {
        name: "team:membersTable.roleSelectAria",
      }),
    );
    fireEvent.click(await screen.findByRole("option", { name }));
  }

  it("changes a role by user id and confirms it", async () => {
    updateRole.mockResolvedValue({});
    render(
      <MembersTable
        workspaceId="workspace-1"
        users={[makeMember("other-user", "member", "Oscar Other")]}
      />,
    );
    await pickRole("team:roles.admin");
    await waitFor(() =>
      expect(updateRole).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        userId: "other-user",
        role: "admin",
      }),
    );
    expect(success).toHaveBeenCalledWith("team:membersTable.roleUpdateSuccess");
  });

  it("shows the API's error when the change is refused", async () => {
    updateRole.mockRejectedValue(new Error("Role not found"));
    render(
      <MembersTable
        workspaceId="workspace-1"
        users={[makeMember("other-user", "member", "Oscar Other")]}
      />,
    );
    await pickRole("team:roles.viewer");
    await waitFor(() => expect(error).toHaveBeenCalledWith("Role not found"));
    expect(success).not.toHaveBeenCalled();
  });
});
