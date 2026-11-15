import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { type GrantsState, pendingGrant } from "../grants-state";

type RevokeDialogProps = {
  state: GrantsState;
  onCancel: () => void;
  onConfirm: (grantId: string) => void;
};

export function RevokeDialog({
  state,
  onCancel,
  onConfirm,
}: RevokeDialogProps) {
  const grant = pendingGrant(state);
  const revoking = state.revoke.status === "revoking";

  return (
    <ConfirmDialog
      open={grant !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={grant ? `Revoke ${grant.clientName}?` : "Revoke agent?"}
      description={
        grant
          ? `${grant.clientName} loses access to Baton right away. This cannot be undone. To use it again, sign in again from that agent.`
          : undefined
      }
      confirmLabel="Revoke access"
      pendingLabel="Revoking…"
      pending={revoking}
      onConfirm={() => grant && onConfirm(grant.id)}
    >
      {state.revoke.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Could not revoke access. Try again.
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
