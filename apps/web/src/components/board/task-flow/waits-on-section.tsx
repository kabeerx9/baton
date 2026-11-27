import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionAddButton } from "@/components/task/sections/section-add-button";
import { useLinkWaitsOn } from "@/hooks/mutations/board/use-link-waits-on";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type { BoardTask } from "../model";
import type { RelatedTask } from "./linked";
import { waitsOnCandidates } from "./waits-on-candidates";
import { WaitsOnPicker } from "./waits-on-picker";
import { BlockerRow } from "./blocker-row";
import { waitsOnRows } from "./waits-on-rows";

type Relations = Parameters<typeof waitsOnRows>[0];

/**
 * "Waits on": the tasks this one cannot finish before. Add or remove a link
 * here. "Needed by" lists what waits on this task, as plain links. The map on
 * top already draws the direct neighbours, so this list stays short.
 */
export function WaitsOnSection({
  taskId,
  workspaceId,
  relations,
  boardTasks,
  keyOf,
  canAdd,
}: {
  taskId: string;
  workspaceId: string;
  relations: Relations;
  boardTasks: BoardTask[];
  keyOf: (task: RelatedTask) => string;
  /** False for a feature: its own column follows its tasks. */
  canAdd: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const [picking, setPicking] = useState(false);
  const link = useLinkWaitsOn();
  const unlink = useDeleteTaskRelation(taskId);

  const { waitsOn, neededBy } = useMemo(
    () => waitsOnRows(relations, taskId),
    [relations, taskId],
  );
  const candidates = useMemo(
    () =>
      waitsOnCandidates(
        boardTasks,
        taskId,
        new Set([...waitsOn, ...neededBy].map((r) => r.task.id)),
      ),
    [boardTasks, taskId, waitsOn, neededBy],
  );

  const add = (blockerId: string) => {
    setPicking(false);
    // The failure toast, with the server's message, lives in the hook.
    link.mutate({ taskId, blockerIds: [blockerId] });
  };
  const remove = (relationId: string) =>
    unlink.mutate(relationId, {
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: ["task-board"] }),
      onError: (error) =>
        toast.error(error.message || t("workspace:board.waitsOn.linkError")),
    });

  return (
    <section aria-labelledby="waits-on-title" className="flex flex-col gap-1">
      <div className="flex h-7 items-center gap-2">
        <h3 id="waits-on-title" className="font-medium text-[13px]">
          {t("workspace:board.waitsOn.title")}
        </h3>
        {waitsOn.length > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {waitsOn.length}
          </span>
        )}
        <span className="flex-1" />
        {canEdit && canAdd && (
          <SectionAddButton
            onClick={() => setPicking(true)}
            disabled={link.isPending}
            aria-label={t("workspace:board.waitsOn.add")}
            title={t("workspace:board.waitsOn.add")}
          />
        )}
      </div>
      {waitsOn.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("workspace:board.waitsOn.empty")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {waitsOn.map((row) => (
            <BlockerRow
              key={row.relationId}
              row={row}
              taskKey={keyOf(row.task)}
              workspaceId={workspaceId}
              onRemove={canEdit ? () => remove(row.relationId) : null}
            />
          ))}
        </ul>
      )}
      {neededBy.length > 0 && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs">
          <span className="font-medium">
            {t("workspace:board.waitsOn.neededBy")}
          </span>
          {neededBy.map((row) => (
            <Link
              key={row.relationId}
              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
              params={{
                workspaceId,
                projectId: row.task.projectId,
                taskId: row.task.id,
              }}
              title={row.task.title}
              className="rounded font-mono outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {keyOf(row.task)}
            </Link>
          ))}
        </p>
      )}
      <WaitsOnPicker
        open={picking}
        onOpenChange={setPicking}
        candidates={candidates}
        onPick={add}
      />
    </section>
  );
}
