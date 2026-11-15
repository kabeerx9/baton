import { CircleCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** No open tasks. The words differ when the person just cleared the list. */
export function MyTasksEmpty({ cleared }: { cleared: boolean }) {
  const { t } = useTranslation();
  return (
    <Empty className="min-h-[70vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheckIcon />
        </EmptyMedia>
        <EmptyTitle>
          {cleared
            ? t("workspace:myTasks.clearedTitle")
            : t("workspace:myWork.empty")}
        </EmptyTitle>
        <EmptyDescription>
          {cleared
            ? t("workspace:myTasks.clearedDescription")
            : t("workspace:myTasks.emptyDescription")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
