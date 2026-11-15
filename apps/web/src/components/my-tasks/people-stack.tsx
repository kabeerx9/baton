import { cn } from "@/lib/cn";
import { PersonAvatar } from "./person-avatar";

/** Up to three overlapping avatars, then a count. A person shows once. */
export function PeopleStack({
  names,
  size = 20,
  className,
}: {
  names: readonly (string | null)[];
  size?: number;
  className?: string;
}) {
  const people = [...new Set(names.filter((name) => name !== null))];
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  const more = people.length - shown.length;
  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {shown.map((name) => (
        <PersonAvatar
          className="not-first:-ml-1.5"
          key={name}
          name={name}
          size={size}
        />
      ))}
      {more > 0 ? (
        <span className="ml-1 text-muted-foreground text-xs tabular-nums">
          +{more}
        </span>
      ) : null}
    </span>
  );
}
