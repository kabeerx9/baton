import { issueLabelNames } from "./rules";

export const isFieldLabel = (name: string) =>
  name.startsWith("status:") || name.startsWith("priority:");

/**
 * Link metadata recording the status and priority labels Baton has accounted
 * for on the issue. Inbound label sync applies only labels added since.
 */
/**
 * The field labels a link's record holds, or null when the record is missing
 * or malformed. Every issue link starts with one; without it, sync in either
 * direction cannot tell which labels Baton accounted for, so it does nothing.
 */
export const recordedFieldLabels = (metadata: { syncFieldLabels?: unknown }) =>
  Array.isArray(metadata.syncFieldLabels) &&
  metadata.syncFieldLabels.every((name) => typeof name === "string")
    ? (metadata.syncFieldLabels as string[])
    : null;

export const confirmedFieldLabels = (labels: unknown) => ({
  syncFieldLabels: issueLabelNames(labels).filter(isFieldLabel),
});
