import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { ProjectTasksSection } from "./project-tasks-section";

const permissions = vi.hoisted(() => ({ canCreateTasks: true }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => permissions.canCreateTasks,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/project/tasks-import-export/export-tasks-row", () => ({
  ExportTasksRow: () => <p>export row</p>,
}));
vi.mock("@/components/project/tasks-import-export/import-tasks-row", () => ({
  ImportTasksRow: () => <p>import row</p>,
}));
vi.mock(
  "@/components/settings/project-general/use-project-move-targets",
  () => ({
    useProjectMoveTargets: () => ({
      moveTargets: [],
      moveTargetsFailed: false,
      canShowMove: false,
    }),
  }),
);

afterEach(() => {
  permissions.canCreateTasks = true;
});

const renderSection = () =>
  render(
    <ProjectTasksSection
      project={{ id: "p1" } as ProjectWithTasks}
      isCurrentProject
      flushPendingSave={async () => true}
    />,
  );

describe("ProjectTasksSection", () => {
  it("offers import to people who can create tasks", () => {
    renderSection();
    expect(screen.getByText("import row")).toBeTruthy();
  });

  it("shows a viewer export but not import", () => {
    permissions.canCreateTasks = false;
    renderSection();
    expect(screen.getByText("export row")).toBeTruthy();
    expect(screen.queryByText("import row")).toBeNull();
  });
});
