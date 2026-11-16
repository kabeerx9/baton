import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import type { McpGrant } from "@/fetchers/mcp/list-grants";
import type { RevokeFlow } from "./revoke-flow";

type RevokeDialogProps = {
  flow: RevokeFlow;
  /** The grant the flow is about, or null when it is not in the list. */
  grant: McpGrant | null;
  onCancel: () => void;
  onConfirm: (grantId: string) => void;
};

export function RevokeDialog({
  flow,
  grant,
  onCancel,
  onConfirm,
}: RevokeDialogProps) {
  const { t } = useTranslation();
  const name = grant?.clientName ?? "";

  return (
    <ConfirmDialog
      open={grant !== null && flow.status !== "idle"}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t("settings:connectAgent.revoke.title", { name })}
      description={t("settings:connectAgent.revoke.description", { name })}
      confirmLabel={t("settings:connectAgent.revoke.confirm")}
      pendingLabel={t("settings:connectAgent.revoke.pending")}
      pending={flow.status === "revoking"}
      onConfirm={() => grant && onConfirm(grant.id)}
    >
      {flow.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          {t("settings:connectAgent.revoke.error")}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
