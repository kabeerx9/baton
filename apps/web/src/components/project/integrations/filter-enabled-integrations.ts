import type { IntegrationStatus } from "./get-integration-status";
import type {
  IntegrationDefinition,
  IntegrationId,
} from "./integration-definitions";

/** Keep saved connections removable even when their provider is turned off. */
export function filterEnabledIntegrations(
  integrations: IntegrationDefinition[],
  disabledProviders: readonly string[],
  statuses: Partial<Record<IntegrationId, IntegrationStatus>> = {},
) {
  return integrations.filter(
    (integration) =>
      !disabledProviders.includes(integration.id) ||
      statuses[integration.id]?.state === "connected" ||
      statuses[integration.id]?.state === "paused",
  );
}
