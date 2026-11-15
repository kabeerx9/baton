import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

const HUES = [210, 28, 152, 330, 262, 188, 12, 96];

function hueOf(name: string): number {
  let sum = 0;
  for (const ch of name) sum = (sum * 31 + ch.charCodeAt(0)) % 997;
  return HUES[sum % HUES.length] ?? 210;
}

/**
 * Initials on a soft tint. The tint comes from the name, so a person keeps one
 * colour. The list of waiting tasks carries names only, so there is no photo.
 * With no name it shows a plain figure: the work has no owner.
 */
export function PersonAvatar({
  name,
  size = 20,
  className,
}: {
  name: string | null;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (!name) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground",
          className,
        )}
        style={box}
      >
        <UserIcon style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <Avatar
      className={cn("shrink-0 ring-1 ring-background", className)}
      style={box}
      title={name}
    >
      <AvatarFallback
        className="font-semibold leading-none [background:oklch(0.93_0.05_var(--h))] [color:oklch(0.45_0.14_var(--h))] dark:[background:oklch(0.35_0.06_var(--h))] dark:[color:oklch(0.88_0.08_var(--h))]"
        style={{ "--h": hueOf(name) } as React.CSSProperties}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
