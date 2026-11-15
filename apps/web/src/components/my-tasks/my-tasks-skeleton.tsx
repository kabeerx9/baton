import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** The page's shape while tasks load: headline, hero, two lists and the rail. */
export function MyTasksSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      aria-busy="true"
      aria-label={t("workspace:myTasks.loading")}
      className="delayed-reveal mx-auto grid max-w-[1120px] gap-x-12 gap-y-8 px-6 pt-10 lg:grid-cols-[minmax(0,1fr)_264px]"
      role="status"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-[420px] max-w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        {[0, 1].map((i) => (
          <div className="flex flex-col gap-2.5" key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-[132px] w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-7 lg:flex">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[92px] w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          {[0, 1, 2].map((i) => (
            <Skeleton className="h-6 w-full" key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
