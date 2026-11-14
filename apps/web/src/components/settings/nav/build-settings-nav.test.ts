import { INSTANCE_PERMISSIONS } from "@baton/permissions";
import { describe, expect, it } from "vite-plus/test";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";

const t = (key: string) => key;

function build(
  overrides: Partial<Parameters<typeof buildSettingsNav>[0]> = {},
) {
  return buildSettingsNav({
    t,
    workspaceName: "Acme",
    adminPermissions: [],
    projects: [],
    ...overrides,
  });
}

describe("buildSettingsNav", () => {
  it("labels the workspace group with the workspace name", () => {
    expect(build().workspace.label).toBe("Acme");
    expect(build({ workspaceName: undefined }).workspace.label).toBe(
      "navigation:page.settingsWorkspaceTab",
    );
  });

  it("lists the workspace pages", () => {
    expect(build().workspace.links.map((link) => link.to)).toEqual([
      "/dashboard/settings/workspace/general",
      "/dashboard/settings/workspace/roles",
      "/dashboard/settings/workspace/labels",
    ]);
  });

  it("shows each administration page only with its permission", () => {
    expect(build().admin).toBeNull();
    expect(
      build({
        adminPermissions: [
          "users:read",
          "roles:manage",
          "workspaces:read",
          "audit:read",
          "system:read",
        ],
      }).admin?.links.map((link) => link.to),
    ).toEqual([
      "/dashboard/settings/admin/overview",
      "/dashboard/settings/admin/users",
      "/dashboard/settings/admin/roles",
      "/dashboard/settings/admin/workspaces",
      "/dashboard/settings/admin/audit-log",
      "/dashboard/settings/admin/system",
    ]);
    expect(
      build({
        adminPermissions: ["audit:read", "users:delete"],
      }).admin?.links.map((link) => link.to),
    ).toEqual(["/dashboard/settings/admin/audit-log"]);
  });

  it("shows webhooks alongside instance settings", () => {
    expect(
      build({ adminPermissions: ["instance:settings"] }).admin?.links.map(
        (link) => link.to,
      ),
    ).toEqual([
      "/dashboard/settings/admin/settings",
      "/dashboard/settings/admin/webhooks",
    ]);
  });

  it.each([
    "users:read",
    "workspaces:read",
    "audit:read",
    "system:read",
  ] as const)("hides Overview without %s", (missing) => {
    expect(
      build({
        adminPermissions: INSTANCE_PERMISSIONS.filter(
          (permission) => permission !== missing,
        ),
      }).admin?.links.map((link) => link.id),
    ).not.toContain("admin-overview");
  });

  it("gives every project its own settings pages", () => {
    const nav = build({
      projects: [{ id: "p1", name: "Baton Web", icon: "Unknown" }],
    });

    expect(nav.projects).toHaveLength(1);
    expect(nav.projects[0]?.links.map((link) => link.to)).toEqual([
      "/dashboard/settings/projects/p1/general",
      "/dashboard/settings/projects/p1/workflow",
      "/dashboard/settings/projects/p1/integrations",
    ]);
    expect(nav.projects[0]?.icon).toBeDefined();
  });
});
