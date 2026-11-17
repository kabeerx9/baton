import { createFileRoute } from "@tanstack/react-router";
import { TaskBoard } from "@/components/board/task-board";
import { useRefetchOnNewDay } from "@/components/board/use-refetch-on-new-day";
import { LaneSockets } from "@/components/board/lane-sockets";
import { buildBoard } from "@/components/board/model";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useLocalDay } from "@/hooks/use-local-day";
import { useGetBoard } from "@/hooks/queries/board/use-get-board";
import { useOverlaidBoard } from "@/hooks/queries/board/use-overlaid-board";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: read, isError, refetch, isFetching } = useGetBoard(workspaceId);
  // Status writes in flight show at once; the refetch settles the rest.
  const data = useOverlaidBoard(read);
  // The server cuts Done at the cutoff the client sent: a new day moves it.
  useRefetchOnNewDay(useLocalDay());
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
              olderDoneCount={data.olderDoneCount}
            />
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}
