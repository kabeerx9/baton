import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCopy } from "./use-copy";

type CopyButtonProps = {
  text: string;
  /** What is being copied, for the accessible name. */
  what: string;
  variant?: "secondary" | "ghost" | "outline";
};

export function CopyButton({
  text,
  what,
  variant = "secondary",
}: CopyButtonProps) {
  const { t } = useTranslation();
  const { status, copy } = useCopy(text);
  const label =
    status === "copied"
      ? t("settings:connectAgent.copy.copied")
      : status === "failed"
        ? t("settings:connectAgent.copy.failed")
        : t("settings:connectAgent.copy.idle");

  return (
    <Button
      type="button"
      size="xs"
      variant={variant}
      aria-label={t("settings:connectAgent.copy.label", {
        status: label,
        what,
      })}
      data-copy-status={status}
      onClick={copy}
      className="min-w-[4.5rem]"
    >
      {status === "copied" ? (
        <CheckIcon aria-hidden="true" className="text-success-foreground" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
      {label}
      <span role="status" className="sr-only">
        {status === "copied"
          ? t("settings:connectAgent.copy.announce", { what })
          : ""}
      </span>
    </Button>
  );
}
