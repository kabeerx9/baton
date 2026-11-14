// A person's recent list stays short: the page shows counts first.
export const RECENT_PER_PERSON = 20;

export type FinishedRow = {
  id: string;
  title: string;
  number: number | null;
  projectId: string;
  projectSlug: string;
  projectName: string;
  projectKind: string;
  userId: string;
  userName: string;
  userImage: string | null;
  finishedAt: Date | string;
};

export type OpenRow = {
  userId: string;
  userName: string;
  userImage: string | null;
  open: number;
};

type Person = {
  user: { id: string; name: string; image: string | null };
  done: number;
  open: number;
  byRepo: Map<string, { projectId: string; name: string; count: number }>;
  recent: {
    id: string;
    key: string;
    title: string;
    projectId: string;
    finishedAt: Date;
  }[];
};

/**
 * Groups finished work and open counts by person. `finished` must arrive
 * newest first: the first rows of each person become their recent list.
 * People with the most finished work come first; ties sort by name.
 */
export function summarizeHistory(finished: FinishedRow[], open: OpenRow[]) {
  const people = new Map<string, Person>();
  const personFor = (id: string, name: string, image: string | null) => {
    let person = people.get(id);
    if (!person) {
      person = {
        user: { id, name, image },
        done: 0,
        open: 0,
        byRepo: new Map(),
        recent: [],
      };
      people.set(id, person);
    }
    return person;
  };

  for (const row of finished) {
    const person = personFor(row.userId, row.userName, row.userImage);
    person.done += 1;
    const repo = person.byRepo.get(row.projectId) ?? {
      projectId: row.projectId,
      // Work with no repo lives in the board project.
      name: row.projectKind === "board" ? "No repo" : row.projectName,
      count: 0,
    };
    repo.count += 1;
    person.byRepo.set(row.projectId, repo);
    if (person.recent.length < RECENT_PER_PERSON) {
      person.recent.push({
        id: row.id,
        key: `${row.projectSlug}-${row.number ?? "?"}`,
        title: row.title,
        projectId: row.projectId,
        finishedAt: new Date(row.finishedAt),
      });
    }
  }
  for (const row of open) {
    personFor(row.userId, row.userName, row.userImage).open = row.open;
  }

  return {
    totalDone: finished.length,
    people: [...people.values()]
      .map((person) => ({
        ...person,
        byRepo: [...person.byRepo.values()].sort((a, b) => b.count - a.count),
      }))
      .sort(
        (a, b) => b.done - a.done || a.user.name.localeCompare(b.user.name),
      ),
  };
}
