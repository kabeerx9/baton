import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsRow } from "@/components/settings/settings-row";
import { leaveWorkspaceErrorMessage } from "@/components/settings/workspace-general/leave-workspace-error-message";
import { Button } from "@/components/ui/button";
import useLeaveWorkspace from "@/hooks/mutations/workspace/use-leave-workspace";
import { leaveGoneWorkspace } from "@/lib/leave-gone-workspace";
import { toast } from "@/lib/toast";

type LeaveWorkspaceRowProps = {
  workspaceId: string | undefined;
  workspaceName: string;
  /** The owner cannot leave; the row says to transfer ownership first. */
  isOwner: boolean;
};

export function LeaveWorkspaceRow({
  workspaceId,
  workspaceName,
  isOwner,
}: LeaveWorkspaceRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = useAuth().user?.id;
  // The dialog names this workspace; the leave uses this id, never whatever
  // is active when the user confirms.
  const [target, setTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { mutateAsync: leave, isPending } = useLeaveWorkspace();

  const handleLeave = async () => {
    if (!target) return;
    const { id, name } = target;
    try {
      await leave({ workspaceId: id });
      toast.success(t("settings:workspaceGeneral.leave.toastLeft", { name }), {
        icon: LogOutIcon,
      });
      setTarget(null);
      await leaveGoneWorkspace(id, {
        queryClient,
        navigate: (destination) => navigate(destination),
        userId,
      });
    } catch (error) {
      toast.error(leaveWorkspaceErrorMessage(error));
    }
  };

  return (
    <>
      <SettingsRow
        stack
        title={t("settings:workspaceGeneral.leave.title")}
        description={
          isOwner
            ? t("settings:workspaceGeneral.leave.ownerDescription", {
                name: workspaceName,
              })
            : t("settings:workspaceGeneral.leave.description", {
                name: workspaceName,
              })
        }
      >
        <Button
          type="button"
          variant="destructive-outline"
          size="sm"
          disabled={!workspaceId || isOwner}
          onClick={() => {
            if (!workspaceId || isOwner) return;
            setTarget({ id: workspaceId, name: workspaceName });
          }}
        >
          {t("settings:workspaceGeneral.leave.button")}
        </Button>
      </SettingsRow>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
        title={t("settings:workspaceGeneral.leave.dialogTitle", {
          name: target?.name ?? "",
        })}
        description={t("settings:workspaceGeneral.leave.dialogDescription", {
          name: target?.name ?? "",
        })}
        confirmLabel={t("settings:workspaceGeneral.leave.confirm")}
        pendingLabel={t("settings:workspaceGeneral.leave.leaving")}
        pending={isPending}
        onConfirm={handleLeave}
      />
    </>
  );
}
