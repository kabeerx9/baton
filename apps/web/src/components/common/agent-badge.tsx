import { BotIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

/** Marks a person's action as made by their agent (API key or MCP), not in the browser. */
export function AgentBadge() {
  const { t } = useTranslation();
  return (
    <Badge size="sm" variant="info">
      <BotIcon />
      {t("common:channel.agent")}
    </Badge>
  );
}
