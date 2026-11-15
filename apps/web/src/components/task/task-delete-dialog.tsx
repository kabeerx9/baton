import { Trash2Icon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  type AlertDialogHandle,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { toast } from "@/lib/toast";

type TaskDeleteDialogProps = {
  handle: AlertDialogHandle<unknown>;
  taskId: string;
  onDeleted: () => void;
  shortcutEnabled?: boolean;
};

export default function TaskDeleteDialog({
  handle,
  taskId,
  onDeleted,
  shortcutEnabled = true,
}: TaskDeleteDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canDeleteTasks, isCheckingPermissions } = useWorkspacePermission();
  const { mutateAsync: deleteTask, isPending } = useDeleteTask();
  const canDelete = !isCheckingPermissions && canDeleteTasks();

  useShortcut("deleteTask", () => handle.open(null), {
    enabled: canDelete && shortcutEnabled,
  });

  useEffect(() => {
    return () => handle.close();
  }, [handle, taskId]);

  if (!canDelete) {
    return null;
  }

  const handleDelete = async () => {
    try {
      const result = await deleteTask(taskId);
      handle.close();
      // A delete by someone outside the task only opens a request: the task
      // stays, so the caller must not leave the page.
      if (result.outcome === "requested") {
        notifyChangeRequested(queryClient, result.task);
        return;
      }
      toast.success(t("tasks:delete.success"), { icon: Trash2Icon });
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <AlertDialog handle={handle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("tasks:delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => void handleDelete()}
          >
            {isPending
              ? t("common:actions.deleting")
              : t("tasks:delete.action")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
