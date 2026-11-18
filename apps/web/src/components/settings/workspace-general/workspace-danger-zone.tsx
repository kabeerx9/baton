import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useDeleteWorkspace from "@/hooks/mutations/workspace/use-delete-workspace";
import { leaveGoneWorkspace } from "@/lib/leave-gone-workspace";
import { toast } from "@/lib/toast";

type WorkspaceDangerZoneProps = {
  workspaceId: string | undefined;
  workspaceName: string;
};

export function WorkspaceDangerZone({
  workspaceId,
  workspaceName,
}: WorkspaceDangerZoneProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = useAuth().user?.id;
  // The dialog names this workspace; the delete uses this id, never whatever
  // is active when the user confirms.
  const [target, setTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [typedName, setTypedName] = useState("");
  const open = target !== null;
  const { mutateAsync: deleteWorkspace, isPending } = useDeleteWorkspace();

  const handleDelete = async () => {
    if (!target) return;
    const { id } = target;

    try {
      await deleteWorkspace({ workspaceId: id });
      toast.success(t("settings:workspaceGeneral.toastDeleted"), {
        icon: Trash2Icon,
      });
      setTarget(null);

      await leaveGoneWorkspace(id, {
        queryClient,
        navigate: (destination) => navigate(destination),
        userId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceGeneral.toastDeleteError"),
      );
    }
  };

  return (
    <SettingsSection title={t("settings:workspaceGeneral.dangerZone")}>
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("settings:workspaceGeneral.deleteWorkspace")}
          description={t(
            "settings:workspaceGeneral.deleteWorkspaceDescription",
            {
              name: workspaceName,
            },
          )}
        >
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            disabled={!workspaceId}
            onClick={() => {
              if (!workspaceId) return;
              setTypedName("");
              setTarget({ id: workspaceId, name: workspaceName });
            }}
          >
            {t("settings:workspaceGeneral.deleteWorkspace")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
        title={t("settings:workspaceGeneral.deleteModalTitle")}
        description={t("settings:workspaceGeneral.deleteModalDescription", {
          name: target?.name ?? "",
        })}
        confirmDisabled={typedName.trim() !== target?.name}
        confirmLabel={t("settings:workspaceGeneral.deleteModalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isPending}
        onConfirm={handleDelete}
      >
        <label className="flex flex-col gap-2 text-sm">
          {t("settings:workspaceGeneral.deleteTypeToConfirm", {
            name: target?.name ?? "",
          })}
          <Input
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            autoComplete="off"
          />
        </label>
      </ConfirmDialog>
    </SettingsSection>
  );
}
