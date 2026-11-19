import { Avatar } from "@/components/board/avatar";
import type { OwnerLoad } from "./feature-status";

/** Who holds the open work, and how much. */
export function OwnerLoadRow({ owners }: { owners: OwnerLoad[] }) {
  if (owners.length === 0) return null;
  return (
    <ul
      aria-label="Open tasks by owner"
      className="flex flex-wrap gap-x-4 gap-y-1.5"
    >
      {owners.map((o) => (
        <li
          key={o.person?.id ?? "none"}
          className="flex items-center gap-1.5 text-muted-foreground text-xs"
        >
          <Avatar person={o.person} size={20} />
          <span className="text-foreground">
            {o.person?.name ?? "Unassigned"}
          </span>
          <span className="tabular-nums">{o.open.length} open</span>
        </li>
      ))}
    </ul>
  );
}
