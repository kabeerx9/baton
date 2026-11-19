import { createHash, randomUUID } from "node:crypto";

export type OutboundIntent = {
  intentId?: string;
  pending?: boolean;
  cancelled?: boolean;
  uncertain?: boolean;
  observedUpdatedAt?: string;
  startedAt?: string;
  priorInboundId?: string;
  ambiguous?: boolean;
};
export type OutboundEntry = OutboundIntent & {
  hash: string;
  timestamp: string;
  updatedAt?: string;
};
export type SyncStamp = {
  timestamp?: string;
  source?: string;
  value?: string;
  inboundAt?: string;
  inboundId?: string;
  inboundValue?: string;
  inboundUpdatedAt?: string;
  outbound?: OutboundEntry[];
};

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function outboundStamp(
  previous: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
  intent: OutboundIntent = {},
): SyncStamp {
  const timestamp = new Date().toISOString();
  const outbound = (previous?.outbound ?? []).filter(
    (entry) => !intent.intentId || entry.intentId !== intent.intentId,
  );
  const previousIntent = previous?.outbound?.find(
    (entry) => intent.intentId && entry.intentId === intent.intentId,
  );
  outbound.push({
    hash: hash(value),
    timestamp,
    updatedAt,
    observedUpdatedAt: previousIntent?.observedUpdatedAt,
    startedAt:
      previousIntent?.startedAt ?? (intent.pending ? timestamp : undefined),
    priorInboundId:
      previousIntent?.priorInboundId ??
      (intent.pending ? previous?.inboundId : undefined),
    ambiguous:
      previousIntent?.ambiguous ||
      !!(
        updatedAt &&
        previousIntent?.observedUpdatedAt === updatedAt &&
        inboundOccurredAfterIntent(previous, previousIntent) &&
        previous?.inboundValue !== value
      ),
    ...intent,
  });
  const bounded = boundOutboundHistory(outbound);
  if (intent.pending || intent.cancelled || intent.uncertain)
    return { ...previous, outbound: bounded };
  return { ...previous, timestamp, source: "baton", value, outbound: bounded };
}

export function boundOutboundHistory(entries: OutboundEntry[]) {
  // Keep active intents until they settle; completed history stays bounded.
  const recent = entries
    .map((entry) =>
      entry.pending && Date.now() - Date.parse(entry.timestamp) >= 300_000
        ? { ...entry, pending: false, uncertain: true }
        : entry,
    )
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const completed = recent.filter((entry) => !entry.pending).slice(-32);
  return [...completed, ...recent.filter((entry) => entry.pending)].sort(
    (left, right) => left.timestamp.localeCompare(right.timestamp),
  );
}

export function pendingOutboundIntent(
  stamp: SyncStamp | undefined,
  value: string,
) {
  return (stamp?.outbound ?? []).find(
    (entry) =>
      entry.pending &&
      !entry.cancelled &&
      entry.hash === hash(value) &&
      Date.now() - Date.parse(entry.timestamp) < 300_000,
  );
}

export function isPendingOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
) {
  return !!pendingOutboundIntent(stamp, value);
}

export function isOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
): boolean {
  const valueHash = hash(value);
  return (stamp?.outbound ?? []).some(
    (entry) =>
      !entry.cancelled &&
      entry.hash === valueHash &&
      (entry.updatedAt && updatedAt
        ? entry.updatedAt === updatedAt
        : Date.now() - Date.parse(entry.timestamp) < 300_000),
  );
}

/** Provider timestamps can collide; historical values need current-provider confirmation. */
export async function confirmedOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt: string | undefined,
  readCurrent: () => Promise<string>,
) {
  if (isPendingOutboundEcho(stamp, value)) return true;
  if (!isOutboundEcho(stamp, value, updatedAt)) return false;
  if (stamp?.value === value) return true;
  return (await readCurrent()) !== value;
}

export function inboundStamp(
  previous: SyncStamp | undefined,
  value: string,
  source: string,
  updatedAt?: string,
): SyncStamp {
  const timestamp = new Date().toISOString();
  return {
    ...previous,
    timestamp,
    source,
    value,
    inboundAt: timestamp,
    inboundId: randomUUID(),
    inboundValue: value,
    inboundUpdatedAt: updatedAt ?? previous?.inboundUpdatedAt,
  };
}
export function ambiguousOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
) {
  return (
    stamp?.outbound?.some(
      (entry) =>
        entry.ambiguous &&
        entry.hash === hash(value) &&
        entry.updatedAt === updatedAt,
    ) ?? false
  );
}
export function hasNewerObservedEdit(
  entry: OutboundEntry | undefined,
  updatedAt: string | undefined,
) {
  if (!updatedAt || !entry?.observedUpdatedAt) return false;
  return (
    Date.parse(entry.observedUpdatedAt) > Date.parse(updatedAt) ||
    (entry.observedUpdatedAt === updatedAt && !!entry.ambiguous)
  );
}

export function uncertainOutboundIntents(
  stamp: SyncStamp | undefined,
  value?: string,
) {
  const valueHash = value === undefined ? undefined : hash(value);
  return (stamp?.outbound ?? []).filter(
    (entry) =>
      !entry.cancelled &&
      (valueHash === undefined || entry.hash === valueHash) &&
      ((!entry.pending && entry.uncertain) ||
        (entry.pending && Date.now() - Date.parse(entry.timestamp) >= 300_000)),
  );
}

export function inboundOccurredAfterIntent(
  stamp: SyncStamp | undefined,
  intent: OutboundEntry | undefined,
) {
  if (!stamp?.inboundId || !intent?.startedAt) return false;
  // IDs keep the order even when two stamps share a millisecond.
  return stamp.inboundId !== intent.priorInboundId;
}
