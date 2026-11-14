import { type LinkedTask, taskKey } from "./linked-task";

/** One `blocks` link, as read for the task it blocks. */
export type BlockLink = {
  blockedId: string;
  blockerId: string;
  /** The blocker passes `taskIsOpen`. */
  isOpen: boolean;
  /** The caller may see the blocker's project. */
  visible: boolean;
  title: string;
  number: number | null;
  slug: string;
  assigneeName: string | null;
};

export type OpenBlockers = { waitsOn: LinkedTask[]; hiddenBlockers: number };

export const NO_BLOCKERS: OpenBlockers = { waitsOn: [], hiddenBlockers: 0 };

/**
 * What each open task waits on. A finished blocker is dropped. A blocker the
 * caller cannot see adds one to `hiddenBlockers` and nothing else, so its
 * title, key and owner never reach the response. Tasks not in `openIds` are
 * done and get no entry.
 */
export function summarizeBlockers(
  links: BlockLink[],
  openIds: ReadonlySet<string>,
) {
  const result = new Map<string, OpenBlockers>();
  for (const link of links) {
    if (!link.isOpen || !openIds.has(link.blockedId)) continue;
    const entry = result.get(link.blockedId) ?? {
      waitsOn: [],
      hiddenBlockers: 0,
    };
    if (link.visible) {
      entry.waitsOn.push({
        id: link.blockerId,
        key: taskKey(link.slug, link.number),
        title: link.title,
        assigneeName: link.assigneeName,
      });
    } else {
      entry.hiddenBlockers += 1;
    }
    result.set(link.blockedId, entry);
  }
  return result;
}
