import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { buildBoard } from "@/components/board/model";
import { PersonCard } from "@/components/board/team-history/person-card";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useGetBoard } from "@/hooks/queries/board/use-get-board";
import { useGetTeamHistory } from "@/hooks/queries/board/use-get-team-history";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/history",
)({
  component: RouteComponent,
  // An unknown or missing period falls back to 30 days.
  validateSearch: (search: Record<string, unknown>): { days?: Period } => {
    const days = Number(search.days);
    return { days: days === 7 || days === 90 ? days : undefined };
  },
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const days: Period = Route.useSearch().days ?? 30;
  const navigate = useNavigate({ from: Route.fullPath });
  const history = useGetTeamHistory(workspaceId, days);
  const { data: board } = useGetBoard(workspaceId);
  const lanes = board ? buildBoard(board).lanes : [];

  return (
    <>
      <PageTitle title="Team history" />
      <WorkspaceLayout
        title="History"
        headerActions={
          <div
            role="tablist"
            aria-label="Period"
            className="flex rounded-lg bg-muted p-0.5 text-xs"
          >
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={period === days}
                onClick={() =>
                  void navigate({
                    search: { days: period === 30 ? undefined : period },
                    replace: true,
                  })
                }
                className={`rounded-md px-2.5 py-1 transition-colors duration-150 ease-out ${
                  period === days
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {period} days
              </button>
            ))}
          </div>
        }
      >
        <div
          data-scroll-restoration-id="history-main"
          className="h-full overflow-auto"
        >
          <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
            <p className="mb-4 text-muted-foreground text-sm sm:mb-6">
              {history.data
                ? `${history.data.totalDone} ${history.data.totalDone === 1 ? "task" : "tasks"} finished in the last ${days} days`
                : " "}
            </p>

            {history.isError && !history.data ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground text-sm">
                Could not load the history.
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void history.refetch()}
                  disabled={history.isFetching}
                >
                  Try again
                </Button>
              </div>
            ) : !history.data ? (
              <p className="delayed-reveal text-muted-foreground text-sm">
                Loading history…
              </p>
            ) : history.data.people.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground text-sm">
                Nobody has tasks assigned yet.
              </p>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
                {history.data.people.map((person) => (
                  <PersonCard
                    key={person.user.id}
                    person={person}
                    lanes={lanes}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
