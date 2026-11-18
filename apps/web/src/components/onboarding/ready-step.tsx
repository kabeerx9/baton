import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ReadySummaryRow } from "./ready-summary-row";

type ReadyStepProps = {
  workspaceName: string;
  projectName: string;
  taskCount: number;
  opening: boolean;
  onOpen: () => void;
};

export function ReadyStep({
  workspaceName,
  projectName,
  taskCount,
  opening,
  onOpen,
}: ReadyStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col rounded-xl border border-border dark:bg-input/16">
        <ReadySummaryRow
          label={t("auth:onboarding.ready.workspace")}
          value={workspaceName}
        />
        <ReadySummaryRow
          label={t("auth:onboarding.ready.project")}
          value={t("auth:onboarding.ready.projectValue", {
            name: projectName,
            count: taskCount,
          })}
        />
      </ul>
      <Button
        size="lg"
        className="self-start"
        autoFocus
        disabled={opening}
        onClick={onOpen}
      >
        {t("auth:onboarding.ready.open", { name: workspaceName })}
      </Button>
    </div>
  );
}
