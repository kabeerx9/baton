import { ShieldCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsNote } from "@/components/settings/settings-note";

export function AgentsNote() {
  const { t } = useTranslation();

  return (
    <SettingsNote icon={ShieldCheckIcon}>
      {t("settings:connectAgent.agentsNote")}
    </SettingsNote>
  );
}
