import { SparklesIcon } from "lucide-react";
import { Trans } from "react-i18next";
import { SettingsNote } from "@/components/settings/settings-note";

export function TryIt() {
  return (
    <SettingsNote icon={SparklesIcon}>
      <Trans
        i18nKey="settings:connectAgent.tryIt"
        components={{ q: <span className="text-foreground" /> }}
      />
    </SettingsNote>
  );
}
