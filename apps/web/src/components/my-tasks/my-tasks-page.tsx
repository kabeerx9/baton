import { MotionConfig } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import { FocusView } from "./focus-view";
import { MyTasksError } from "./my-tasks-error";
import { MyTasksSkeleton } from "./my-tasks-skeleton";

/** The body of the My tasks page: loading, a failed first load, or the queue. */
export function MyTasksPage({ workspaceId }: { workspaceId: string }) {
  const { data, isError, refetch, dataUpdatedAt } =
    useGetAssignedTasks(workspaceId);
  return (
    // "user": people who ask for less motion get fades, not movement.
    <MotionConfig reducedMotion="user">
      <ScrollArea data-tour="my-tasks">
        {data ? (
          // Loaded tasks stay on screen when a background refresh fails.
          <FocusView
            dataUpdatedAt={dataUpdatedAt}
            key={workspaceId}
            tasks={data.tasks}
            total={data.total}
            workspaceId={workspaceId}
          />
        ) : isError ? (
          <MyTasksError onRetry={() => void refetch()} />
        ) : (
          <MyTasksSkeleton />
        )}
      </ScrollArea>
    </MotionConfig>
  );
}
