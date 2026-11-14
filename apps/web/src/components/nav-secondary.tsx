import { useNavigate } from "@tanstack/react-router";
import { FolderGit2, Settings, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function NavSecondary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canInviteUsers } = useWorkspacePermission();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { data: workspace } = useActiveWorkspace();

  return (
    <>
      <SidebarMenu className="gap-0.5">
        {canInviteUsers() && (
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              className="h-8 text-sm"
              onClick={() => setIsInviteOpen(true)}
            >
              <UserPlus aria-hidden="true" />
              <span>{t("navigation:sidebar.invitePeople")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {workspace && (
          <SidebarMenuItem>
            {/* Where repos are added and renamed. A repo has no board. */}
            <SidebarMenuButton
              size="default"
              className="h-8 text-sm"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId/projects",
                  params: { workspaceId: workspace.id },
                })
              }
            >
              <FolderGit2 aria-hidden="true" />
              <span>Repos</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        <SidebarMenuItem>
          <SidebarMenuButton
            size="default"
            className="h-8 text-sm"
            onClick={() =>
              navigate({ to: "/dashboard/settings/account/information" })
            }
          >
            <Settings aria-hidden="true" />
            <span>{t("navigation:userMenu.settings")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <InviteTeamMemberModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
}
