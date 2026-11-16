import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import type { InstanceKind } from "./instance";

/** Says what a plain-http URL means for clients. Nothing for https. */
export function InstanceNotice({ kind }: { kind: InstanceKind }) {
  const { t } = useTranslation();

  if (kind === "https") return null;

  if (kind === "loopback") {
    return (
      <Alert variant="info">
        <InfoIcon aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">
            {t("settings:connectAgent.notice.loopbackTitle")}
          </p>
          <p className="text-muted-foreground">
            {t("settings:connectAgent.notice.loopbackBody")}
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <Alert variant="warning">
      <AlertTriangleIcon aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium">
          {t("settings:connectAgent.notice.remoteTitle")}
        </p>
        <p className="text-muted-foreground">
          {t("settings:connectAgent.notice.remoteBody")}
        </p>
      </div>
    </Alert>
  );
}
