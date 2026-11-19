import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { as, changeRequestFixture, readTask } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { seedViewerBoard } from "./helpers/viewer-board";

// PUT /api/task/{id} asks for task:assign only when the owner changes. An
// omitted userId keeps the owner; "" clears it.

beforeEach(resetTestDatabase);

type Task = NonNullable<Awaited<ReturnType<typeof readTask>>>;

function fullUpdate(
  send: ReturnType<typeof as>,
  task: Task,
  fields: Record<string, unknown>,
) {
  return send(`/api/task/${task.id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: task.title,
      status: task.status,
      priority: task.priority ?? "no-priority",
      projectId: task.projectId,
      position: task.position ?? 0,
      ...fields,
    }),
  });
}

async function unassignedTask(projectId: string, createdBy: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Nobody owns this",
      status: "to-do",
      number: 2,
      position: 2,
      createdBy,
      userId: null,
    })
    .returning();
  return task!;
}

describe("full task update by someone without task:assign", () => {
  it("renames an assigned task when userId is omitted", async () => {
    const f = await changeRequestFixture();
    const response = await fullUpdate(as(f.outsider), f.task, {
      title: "Renamed by an outsider",
    });
    expect(response.status).toBe(200);
    const task = await readTask(f.task.id);
    expect(task?.title).toBe("Renamed by an outsider");
    expect(task?.userId).toBe(f.assignee.id);
  });

  it("sets a start date on an unassigned task, as the web client sends it", async () => {
    const f = await changeRequestFixture();
    const task = await unassignedTask(f.project.id, f.creator.id);
    const startDate = "2026-12-01T00:00:00.000Z";
    for (const fields of [{ startDate }, { startDate, userId: "" }]) {
      const response = await fullUpdate(as(f.outsider), task, fields);
      expect(response.status, JSON.stringify(fields)).toBe(200);
    }
    const saved = await readTask(task.id);
    expect(saved?.startDate?.toISOString()).toBe(startDate);
    expect(saved?.userId).toBeNull();
  });

  it("sending the current owner is not a change", async () => {
    const f = await changeRequestFixture();
    const response = await fullUpdate(as(f.outsider), f.task, {
      title: "Same owner",
      userId: f.assignee.id,
    });
    expect(response.status).toBe(200);
  });

  it("still refuses to clear or take the owner", async () => {
    const f = await changeRequestFixture();
    for (const userId of ["", f.outsider.id]) {
      const response = await fullUpdate(as(f.outsider), f.task, { userId });
      expect(response.status, `userId=${userId}`).toBe(403);
      const body = (await response.json()) as { code: string };
      expect(body.code).toBe("MISSING_PERMISSION");
    }
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);
  });

  it("refuses to assign an unassigned task", async () => {
    const f = await changeRequestFixture();
    const task = await unassignedTask(f.project.id, f.creator.id);
    const response = await fullUpdate(as(f.outsider), task, {
      userId: f.outsider.id,
    });
    expect(response.status).toBe(403);
    expect((await readTask(task.id))?.userId).toBeNull();
  });
});

describe("full task update with task:assign", () => {
  it("keeps the owner when userId is omitted and clears it with an empty string", async () => {
    const f = await changeRequestFixture();
    const send = as(f.admin);
    const kept = await fullUpdate(send, f.task, { title: "Kept" });
    expect(kept.status).toBe(200);
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);

    const cleared = await fullUpdate(send, (await readTask(f.task.id))!, {
      userId: "",
    });
    expect(cleared.status).toBe(200);
    expect((await readTask(f.task.id))?.userId).toBeNull();

    const assigned = await fullUpdate(send, (await readTask(f.task.id))!, {
      userId: f.assignee.id,
    });
    expect(assigned.status).toBe(200);
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);
  });
});

describe("full task update by a viewer", () => {
  it("edits their own task without userId", async () => {
    const f = await seedViewerBoard();
    const own = (await readTask(f.own.id))!;
    const response = await fullUpdate(as(f.viewer), own, {
      title: "Viewer renamed own",
    });
    expect(response.status).toBe(200);
    const saved = await readTask(f.own.id);
    expect(saved?.title).toBe("Viewer renamed own");
    expect(saved?.userId).toBe(f.viewer.id);
  });

  it("is refused on another person's task, with or without userId", async () => {
    const f = await seedViewerBoard();
    const other = (await readTask(f.other.id))!;
    for (const fields of [
      { title: "Viewer renamed other" },
      { title: "Viewer renamed other", userId: f.member.id },
    ]) {
      const response = await fullUpdate(as(f.viewer), other, fields);
      expect(response.status, JSON.stringify(fields)).toBe(403);
      const body = (await response.json()) as { code: string };
      expect(body.code).toBe("NOT_ASSIGNED");
    }
    expect((await readTask(f.other.id))?.title).toBe(other.title);
  });

  it("cannot unassign their own task through a full update", async () => {
    const f = await seedViewerBoard();
    const own = (await readTask(f.own.id))!;
    const response = await fullUpdate(as(f.viewer), own, { userId: "" });
    expect(response.status).toBe(403);
    expect((await readTask(f.own.id))?.userId).toBe(f.viewer.id);
  });
});
