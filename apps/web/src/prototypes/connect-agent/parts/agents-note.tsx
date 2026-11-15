import { ShieldCheckIcon } from "lucide-react";
import { SettingsNote } from "@/components/settings/settings-note";

export function AgentsNote() {
  return (
    <SettingsNote icon={ShieldCheckIcon}>
      Agents name themselves, so Baton cannot check the name. Match the date and
      workspace to what you did. Revoke anything you do not recognise.
    </SettingsNote>
  );
}
