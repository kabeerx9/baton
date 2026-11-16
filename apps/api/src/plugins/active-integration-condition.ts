import { and, eq, type SQLWrapper, sql } from "drizzle-orm";
import { integrationTable } from "../database/schema";
import { projectInActiveWorkspace } from "../workspace/archive/active-workspace-sql";
import { projectInTeamWorkspace } from "../workspace/kind/workspace-kind";

/** True unless an administrator turned this integration provider off. */
export function integrationProviderEnabled(type: SQLWrapper) {
  return sql<boolean>`not exists (
    select 1 from "instance_settings" as "provider_settings"
    where ${type} = any("provider_settings"."disabled_integrations")
  )`;
}

/**
 * An integration acts (webhooks in or out, syncs, reminders) only while it is
 * enabled, its workspace is not archived, and its provider is not turned off.
 * It never acts in a demo workspace: this is the integrations' side-effect
 * guard, so nothing about a product-tour sandbox reaches a provider.
 * Read in SQL so every API instance sees a change at once.
 */
export function activeIntegrationCondition() {
  return and(
    eq(integrationTable.isActive, true),
    projectInActiveWorkspace(integrationTable.projectId),
    projectInTeamWorkspace(integrationTable.projectId),
    integrationProviderEnabled(integrationTable.type),
  );
}
