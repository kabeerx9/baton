import { SparklesIcon } from "lucide-react";
import { SettingsNote } from "@/components/settings/settings-note";

export function TryIt() {
  return (
    <SettingsNote icon={SparklesIcon}>
      Connected? Ask your agent:{" "}
      <span className="text-foreground">“what tasks do I have?”</span>
    </SettingsNote>
  );
}
