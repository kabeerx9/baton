import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const baselineSql = readFileSync(
  new URL("../../../apps/api/drizzle/0000_baseline.sql", import.meta.url),
  "utf8",
);

describe("baseline FK-supporting indexes", () => {
  it("creates an index for each foreign key the boards join and cascade on", () => {
    const indexNames = [
      "activity_userId_idx",
      "asset_createdBy_idx",
      "invitation_inviterId_idx",
      "notification_userId_idx",
      "task_assigneeId_idx",
      "task_columnId_idx",
      "user_notification_workspace_project_workspaceId_projectId_idx",
      "unwp_workspaceId_workspaceRuleId_idx",
      "workflow_rule_columnId_idx",
    ];

    for (const indexName of indexNames) {
      expect(baselineSql).toContain(`CREATE INDEX "${indexName}"`);
    }
    expect(baselineSql).not.toContain("CONCURRENTLY");
  });
});
