import type { AdminAuditRequest } from "../../admin/audit/admin-audit-request";
import type { AuthMethod } from "../../utils/request-channel";

/**
 * Who performs a workspace write. `member` comes from the member routes and
 * is authorized under the workspace lock; `instance_admin` is reachable only
 * from `/api/admin/*`, which already checked the instance permission, and
 * writes the audit row.
 */
export type WorkspaceActor =
  | {
      kind: "member";
      userId: string;
      authMethod: AuthMethod | undefined;
      apiKeyId: string | null;
    }
  | { kind: "instance_admin"; audit: AdminAuditRequest };
