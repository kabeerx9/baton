import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import type { InstanceKind } from "../instance";

/** Says what a plain-http URL means for clients. Nothing for https. */
export function InstanceNotice({ kind }: { kind: InstanceKind }) {
  if (kind === "https") return null;

  if (kind === "loopback") {
    return (
      <Alert variant="info">
        <InfoIcon aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">Plain http works on localhost</p>
          <p className="text-muted-foreground">
            Agents on this machine can connect. Another device needs an https
            address.
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <Alert variant="warning">
      <AlertTriangleIcon aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium">This address uses http on your network</p>
        <p className="text-muted-foreground">
          Some agents refuse plain http away from localhost. If sign-in fails,
          open Baton through localhost or set up https.
        </p>
      </div>
    </Alert>
  );
}
