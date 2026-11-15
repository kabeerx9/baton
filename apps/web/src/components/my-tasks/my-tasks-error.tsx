import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** The list did not load and there is nothing cached to show. */
export function MyTasksError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Empty className="min-h-[70vh]" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("workspace:myWork.loadError")}</EmptyTitle>
        <EmptyDescription>
          {t("workspace:myTasks.errorDescription")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} variant="outline">
          {t("workspace:myTasks.retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
