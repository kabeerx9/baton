import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddSubtask } from "@/hooks/mutations/board/use-add-subtask";
import { AssigneeSelect } from "./assignee-select";
import type { BoardTask, Lane } from "./model";

/**
 * Add a task under a feature: pick its repo (or none), who does it, and
 * optionally which of the feature's tasks it waits on.
 */
export function AddSubtaskDialog({
  boardTask,
  lanes,
  workspaceId,
  open,
  onOpenChange,
  defaultLaneId,
}: {
  boardTask: BoardTask;
  lanes: Lane[];
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLaneId?: string;
}) {
  const [title, setTitle] = useState("");
  const [laneId, setLaneId] = useState(
    defaultLaneId ?? lanes[0]?.projectId ?? "",
  );
  const [assignee, setAssignee] = useState<string | undefined>();
  const [blockerIds, setBlockerIds] = useState<string[]>([]);
  const { t } = useTranslation();
  const addTask = useAddSubtask();
  const busy = addTask.isPending;
  const lane = lanes.find((l) => l.projectId === laneId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !laneId) return;
    // One mutation creates the task and links it. Only the form reset is
    // here; the links and any failure toast survive the dialog closing.
    addTask.mutate(
      {
        taskId: boardTask.id,
        projectId: laneId,
        title: title.trim(),
        userId: assignee,
        blockerIds,
      },
      {
        onSuccess: () => {
          setTitle("");
          setBlockerIds([]);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <form className="contents" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a task to {boardTask.title}</DialogTitle>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <label
              htmlFor="subtask-title"
              className="flex flex-col gap-1.5 text-sm"
            >
              <span className="text-muted-foreground">What needs doing</span>
              <Input
                id="subtask-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fill live_projected_points in lineup stats"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Repo</span>
                <Select
                  value={laneId}
                  onValueChange={(v) => typeof v === "string" && setLaneId(v)}
                >
                  <SelectTrigger aria-label="Repo">
                    <SelectValue>
                      {lane ? (
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${lane.tone.dot}`}
                          />
                          {lane.general ? "No repo" : lane.name}
                        </span>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {lanes.map((l) => (
                      <SelectItem key={l.projectId} value={l.projectId}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${l.tone.dot}`}
                          />
                          {l.general ? "No repo" : l.name}
                          {l.repository && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {l.repository.split("/")[1]}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Who</span>
                <AssigneeSelect
                  workspaceId={workspaceId}
                  value={assignee}
                  onChange={setAssignee}
                />
              </div>
            </div>
            {boardTask.subtasks.length > 0 && (
              <fieldset className="flex flex-col gap-1.5 text-sm">
                <legend className="text-muted-foreground">
                  {t("workspace:board.addTask.waitsOn")}
                </legend>
                <p className="text-muted-foreground text-xs">
                  {t("workspace:board.addTask.waitsOnHint")}
                </p>
                <div className="flex max-h-36 flex-col overflow-y-auto">
                  {boardTask.subtasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={blockerIds.includes(task.id)}
                        onCheckedChange={(checked) =>
                          setBlockerIds((ids) =>
                            checked
                              ? [...ids, task.id]
                              : ids.filter((id) => id !== task.id),
                          )
                        }
                      />
                      <span className="shrink-0 font-mono text-muted-foreground text-xs">
                        {task.key}
                      </span>
                      <span className="truncate">{task.title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {addTask.isError && (
              <p className="text-sm text-destructive">
                {addTask.error.message}
              </p>
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
            <Button type="submit" disabled={!title.trim() || !laneId || busy}>
              {busy ? "Adding..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
