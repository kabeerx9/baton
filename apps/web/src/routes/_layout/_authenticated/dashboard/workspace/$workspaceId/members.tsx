import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { JoinLinkCard } from "@/components/team/join-link-card";
import MembersTable from "@/components/team/members-table";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: members } = useGetWorkspaceUsers(workspaceId);
  const { canInviteUsers } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("team:members.pageTitle")} />
      <WorkspaceLayout title={t("team:members.pageTitle")}>
        {canInviteUsers() ? (
          <div className="pb-6">
            <JoinLinkCard workspaceId={workspaceId} />
          </div>
        ) : null}
        <MembersTable workspaceId={workspaceId} users={members ?? []} />
      </WorkspaceLayout>
    </>
  );
}
