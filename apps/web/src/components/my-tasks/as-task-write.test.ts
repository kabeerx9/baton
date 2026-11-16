import { expect, it } from "vite-plus/test";
import { asTaskWrite } from "./as-task-write";
import { assigned } from "./test-task";

const task = assigned("t1", {
  projectId: "p-api",
  status: "in-progress",
  dueDate: "2026-11-20T12:00:00.000Z",
});

it("keeps the id and project the mutation hooks read, and applies the change", () => {
  const write = asTaskWrite(task, { status: "done" });
  expect(write).toMatchObject({
    id: "t1",
    projectId: "p-api",
    status: "done",
    dueDate: "2026-11-20T12:00:00.000Z",
  });
});

it("can clear the due date without touching the status", () => {
  const write = asTaskWrite(task, { dueDate: null });
  expect(write.dueDate).toBeNull();
  expect(write.status).toBe("in-progress");
});
