import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateBoardTask } from "@/hooks/mutations/board/use-create-board-task";
import { AssigneeSelect } from "./assignee-select";

/**
 * A name and, optionally, who does it. That is already a complete piece of
 * work; repo tasks are added later from the task page when it needs them.
 */
export function NewTaskDialog({
  workspaceId,
  open,
  onOpenChange,
  onCreated,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a plain "Create", which stays on the board. */
  onCreated: (task: { id: string }) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string | undefined>();
  const create = useCreateBoardTask();

  // "Create" stays on the board. "Create and add tasks" opens the new task's
  // page with the Add task dialog already open.
  const createTask = (then: "stay" | "add") => {
    if (!title.trim() || create.isPending) return;
    create.mutate(
      { workspaceId, title: title.trim(), userId: assignee },
      {
        onSuccess: (task) => {
          setTitle("");
          setAssignee(undefined);
          onOpenChange(false);
          if (then === "add") {
            void navigate({
              to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
              params: {
                workspaceId,
                projectId: task.projectId,
                taskId: task.id,
              },
              search: { addTasks: true },
            });
          } else {
            onCreated(task);
          }
        },
      },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask("stay");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <form className="contents" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <label
              htmlFor="task-name"
              className="flex flex-col gap-1.5 text-sm"
            >
              <span className="text-muted-foreground">What is it</span>
              <Input
                id="task-name"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fix the login crash"
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Who</span>
              <AssigneeSelect
                workspaceId={workspaceId}
                value={assignee}
                onChange={setAssignee}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Small job? This is enough. Bigger one? Open it and add tasks under
              it. It then becomes a feature.
            </p>
            {create.isError && (
              <p className="text-sm text-destructive">{create.error.message}</p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!title.trim() || create.isPending}
              onClick={() => createTask("add")}
            >
              {t("workspace:board.newTask.createAndAdd")}
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
