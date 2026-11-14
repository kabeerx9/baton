import { createFileRoute } from "@tanstack/react-router";
import { TaskBoard } from "@/components/board/task-board";
import { LaneSockets } from "@/components/board/lane-sockets";
import { buildBoard } from "@/components/board/model";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useGetBoard } from "@/hooks/queries/board/use-get-board";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data, isError, refetch, isFetching } = useGetBoard(workspaceId);
  const board = data ? buildBoard(data) : null;

  return (
    <>
      <PageTitle title="Board" />
      <WorkspaceLayout title="Board">
        {isError && !data ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            Could not load the board.
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : !board || !data ? (
          <div className="delayed-reveal p-6 text-sm text-muted-foreground">
            Loading board…
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <LaneSockets projectIds={data.projects.map((p) => p.id)} />
            <TaskBoard
              boardTasks={board.boardTasks}
              lanes={board.lanes}
              workspaceId={workspaceId}
            />
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}
