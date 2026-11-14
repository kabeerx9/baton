import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function useSettingsNav() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const { permissions: adminPermissions } = useAdminAccess();

  return useMemo(
    () =>
      buildSettingsNav({
        t,
        workspaceName: workspace?.name,
        adminPermissions,
        projects: projects ?? [],
      }),
    [t, workspace?.name, adminPermissions, projects],
  );
}
