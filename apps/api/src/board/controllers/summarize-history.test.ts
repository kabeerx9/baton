import { describe, expect, it } from "vite-plus/test";
import {
  type FinishedRow,
  RECENT_PER_PERSON,
  summarizeHistory,
} from "./summarize-history";

const row = (over: Partial<FinishedRow>): FinishedRow => ({
  id: "t1",
  title: "Task",
  number: 1,
  projectId: "app",
  projectSlug: "APP",
  projectName: "App",
  projectKind: "repo",
  userId: "u1",
  userName: "Kabeer",
  userImage: null,
  finishedAt: "2026-11-10T10:00:00.000Z",
  ...over,
});

describe("summarizeHistory", () => {
  it("counts finished work per person and per repo", () => {
    const result = summarizeHistory(
      [
        row({ id: "a" }),
        row({ id: "b", projectId: "api", projectName: "API" }),
        row({ id: "c" }),
        row({ id: "d", userId: "u2", userName: "Aakash" }),
      ],
      [],
    );
    expect(result.totalDone).toBe(4);
    const kabeer = result.people[0];
    expect(kabeer?.user.name).toBe("Kabeer");
    expect(kabeer?.done).toBe(3);
    expect(kabeer?.byRepo).toEqual([
      { projectId: "app", name: "App", count: 2 },
      { projectId: "api", name: "API", count: 1 },
    ]);
  });

  it("labels work in the board project as having no repo", () => {
    const result = summarizeHistory(
      [row({ projectId: "board", projectKind: "board", projectSlug: "T" })],
      [],
    );
    expect(result.people[0]?.byRepo[0]?.name).toBe("No repo");
    expect(result.people[0]?.recent[0]?.key).toBe("T-1");
  });

  it("includes a person who has open work but finished nothing", () => {
    const result = summarizeHistory(
      [row({})],
      [{ userId: "u3", userName: "Rohan", userImage: null, open: 2 }],
    );
    const rohan = result.people.find((p) => p.user.id === "u3");
    expect(rohan).toMatchObject({ done: 0, open: 2, recent: [] });
  });

  it("puts the person with the most finished work first, then by name", () => {
    const result = summarizeHistory(
      [
        row({ id: "a", userId: "u2", userName: "Priya" }),
        row({ id: "b", userId: "u1", userName: "Aakash" }),
        row({ id: "c", userId: "u3", userName: "Rohan" }),
        row({ id: "d", userId: "u3", userName: "Rohan" }),
      ],
      [],
    );
    expect(result.people.map((p) => p.user.name)).toEqual([
      "Rohan",
      "Aakash",
      "Priya",
    ]);
  });

  it("keeps the count exact but caps the recent list", () => {
    const many = Array.from({ length: RECENT_PER_PERSON + 5 }, (_, i) =>
      row({ id: `t${i}`, number: i }),
    );
    const person = summarizeHistory(many, []).people[0];
    expect(person?.done).toBe(RECENT_PER_PERSON + 5);
    expect(person?.recent).toHaveLength(RECENT_PER_PERSON);
    expect(person?.recent[0]?.id).toBe("t0");
  });
});
