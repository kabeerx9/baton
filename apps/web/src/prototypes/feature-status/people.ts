import { type Person, toPerson } from "@/components/board/model";

function person(id: string, name: string): Person {
  const made = toPerson({ id, name, image: null });
  if (!made) throw new Error("person fixture");
  return made;
}

export const KABEER = person("u-kabeer", "Kabeer Joshi");
export const AISHA = person("u-aisha", "Aisha Khan");
export const ROHAN = person("u-rohan", "Rohan Mehta");
export const MARIA = person("u-maria", "Maria Silva");

const BY_ID = new Map(
  [KABEER, AISHA, ROHAN, MARIA].map((member) => [member.id, member]),
);

/** The first name for a user id, or "Someone" for an id the fixtures lack. */
export function nameOf(userId: string | null): string {
  return (userId && BY_ID.get(userId)?.name) || "Someone";
}
