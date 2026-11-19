import { scrubDeep, scrubText } from "./scrub";

// rrweb event types that carry URLs as data: 4 = Meta (page href),
// 5 = Custom (Replay's own breadcrumbs, navigation and network entries).
const URL_EVENT_TYPES = new Set([4, 5]);

/**
 * Replay records page URLs outside beforeSend and beforeBreadcrumb, so its
 * URL-bearing events go through the same scrubber. DOM snapshots are left
 * alone: their text and inputs are masked by Replay itself.
 */
export function scrubRecordingEvent<E extends { type: number; data?: unknown }>(
  event: E,
): E {
  return URL_EVENT_TYPES.has(event.type)
    ? { ...event, data: scrubDeep(event.data) }
    : event;
}

type ReplayEventish = {
  type?: string;
  urls?: string[];
  request?: { url?: string };
};

/**
 * Replay events list every page URL in `urls` and skip beforeSend, so a
 * global event processor scrubs them. Other events pass through unchanged.
 */
export function scrubReplayEvent<E extends ReplayEventish>(event: E): E | null {
  if (event.type !== "replay_event") return event;
  try {
    return {
      ...event,
      ...(event.urls && { urls: event.urls.map(scrubText) }),
      ...(event.request && { request: scrubDeep(event.request) }),
    };
  } catch {
    return null;
  }
}
