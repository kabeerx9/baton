import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogCreateHandle,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import type { useTaskCopyActions } from "./use-task-copy-actions";
import { TaskMoreMenu } from "./task-more-menu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canDeleteTasks: () => true }),
}));

const actions = {
  copyLink: vi.fn(),
  copyBranch: vi.fn(),
  copyId: vi.fn(),
  copyTitle: vi.fn(),
  copyMarkdown: vi.fn(),
} as unknown as ReturnType<typeof useTaskCopyActions>;

/** A real mouse press, so the menu treats the click as a pointer press. */
function press(element: Element) {
  fireEvent.pointerDown(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskMoreMenu delete action", () => {
  it("opens the alert dialog from the handle it was given", async () => {
    const handle = AlertDialogCreateHandle();
    render(
      <ShortcutTestWrapper>
        <TaskMoreMenu actions={actions} deleteHandle={handle} />
        <AlertDialog handle={handle}>
          <AlertDialogContent>
            <AlertDialogTitle>tasks:delete.title</AlertDialogTitle>
            <AlertDialogClose>common:actions.cancel</AlertDialogClose>
          </AlertDialogContent>
        </AlertDialog>
      </ShortcutTestWrapper>,
    );

    press(screen.getByRole("button", { name: "tasks:bulk.moreActions" }));
    const item = await screen.findByRole("menuitem", {
      name: /tasks:delete\.action/,
    });
    press(item);

    expect(await screen.findByText("tasks:delete.title")).toBeTruthy();
    expect(handle.isOpen).toBe(true);

    press(screen.getByRole("button", { name: "common:actions.cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("tasks:delete.title")).toBeNull(),
    );
    expect(handle.isOpen).toBe(false);
  });
});
