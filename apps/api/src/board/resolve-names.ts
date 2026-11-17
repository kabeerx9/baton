/**
 * People and repos by the words a person would use. Agents and scripts send
 * "Aakash" and "API"; these turn that into ids, or into a message that lists
 * the valid choices.
 */

export type Named<T> = { ok: true; value: T } | { ok: false; message: string };

export type Member = { id: string; name: string; email: string };
export type Repo = { id: string; name: string; slug: string; kind: string };

const norm = (text: string) => text.trim().toLowerCase();

/** Matches an id, an email, a full name, or a first name that only one person has. */
export function matchMember(members: Member[], ref: string): Named<Member> {
  const wanted = norm(ref);
  const exact = members.filter(
    (m) =>
      m.id === ref.trim() ||
      norm(m.email) === wanted ||
      norm(m.name) === wanted,
  );
  const found = exact.length
    ? exact
    : members.filter((m) => norm(m.name).split(/\s+/)[0] === wanted);
  if (found.length === 1 && found[0]) return { ok: true, value: found[0] };
  const names = members.map((m) => m.name).join(", ");
  return {
    ok: false,
    message:
      found.length > 1
        ? `"${ref}" matches more than one person. Use a full name or an email. People: ${names}.`
        : `Nobody is called "${ref}". People: ${names}.`,
  };
}

const NO_REPO = new Set(["", "none", "no repo", "general", "board"]);

/**
 * Matches a repo by its id, its key (API), its name, or the start of its name.
 * "none" and its synonyms mean a subtask with no repo: the board project.
 */
export function matchRepo(repos: Repo[], ref: string | undefined): Named<Repo> {
  const wanted = norm(ref ?? "");
  const board = repos.find((r) => r.kind === "board");
  if (NO_REPO.has(wanted)) {
    return board
      ? { ok: true, value: board }
      : { ok: false, message: "This workspace has no board yet." };
  }
  const real = repos.filter((r) => r.kind === "repo");
  const exact = real.filter(
    (r) =>
      r.id === (ref ?? "").trim() ||
      norm(r.slug) === wanted ||
      norm(r.name) === wanted,
  );
  const found = exact.length
    ? exact
    : real.filter(
        (r) =>
          norm(r.name).startsWith(wanted) ||
          norm(r.name).includes(`(${wanted}`),
      );
  if (found.length === 1 && found[0]) return { ok: true, value: found[0] };
  const choices = real.map((r) => `${r.slug} (${r.name})`).join(", ");
  return {
    ok: false,
    message:
      found.length > 1
        ? `"${ref}" matches more than one repo. Use the key. Repos: ${choices}.`
        : `There is no repo "${ref}". Repos: ${choices}. Use "none" for work with no repo.`,
  };
}

const STATUS_WORDS: Record<string, string> = {
  todo: "to-do",
  "to do": "to-do",
  "to-do": "to-do",
  doing: "in-progress",
  started: "in-progress",
  "in progress": "in-progress",
  "in-progress": "in-progress",
  review: "in-review",
  "in review": "in-review",
  "in-review": "in-review",
  done: "done",
  finished: "done",
  complete: "done",
  completed: "done",
};

/** "in progress" or "done" to the column slug. Anything else passes through. */
export function statusSlug(word: string) {
  return STATUS_WORDS[norm(word)] ?? word.trim();
}

/** True for a ticket key such as API-3 or T-12. */
/**
 * The task number in a key, or null when it cannot be a stored number
 * (`task.number` is int4). A caller answers null as "no such task".
 */
export function keyNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= 2_147_483_647
    ? number
    : null;
}

export function isKey(ref: string) {
  return /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(ref.trim());
}
