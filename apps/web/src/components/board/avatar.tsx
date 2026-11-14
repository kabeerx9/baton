import type { Person } from "./model";

export function Avatar({
  person,
  size = 20,
}: {
  person: Person | null;
  size?: number;
}) {
  if (!person) {
    return (
      <span
        title="Unassigned"
        className="inline-flex shrink-0 rounded-full border border-dashed border-muted-foreground/50"
        style={{ width: size, height: size }}
      />
    );
  }
  if (person.image) {
    return (
      <img
        src={person.image}
        alt={person.name}
        title={person.name}
        className="shrink-0 rounded-full object-cover ring-2 ring-card"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={person.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ring-2 ring-card"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `oklch(0.62 0.15 ${person.hue})`,
      }}
    >
      {person.initials}
    </span>
  );
}
