import { describe, expect, it } from "vite-plus/test";
import { canWorkOnTask } from "./can-work-on-task";

const viewer = { updateTasks: false, updateAssignedTasks: true };
const member = { updateTasks: true, updateAssignedTasks: true };
const reader = { updateTasks: false, updateAssignedTasks: false };

describe("canWorkOnTask", () => {
  it("lets task:update work on any task", () => {
    expect(canWorkOnTask(member, "me", "someone")).toBe(true);
    expect(canWorkOnTask(member, "me", null)).toBe(true);
  });

  it("lets task:update_assigned work only on the caller's own task", () => {
    expect(canWorkOnTask(viewer, "me", "me")).toBe(true);
    expect(canWorkOnTask(viewer, "me", "someone")).toBe(false);
    expect(canWorkOnTask(viewer, "me", null)).toBe(false);
  });

  it("never matches an unknown caller to an unassigned task", () => {
    expect(canWorkOnTask(viewer, undefined, undefined)).toBe(false);
    expect(canWorkOnTask(viewer, null, null)).toBe(false);
    expect(canWorkOnTask(viewer, "", "")).toBe(false);
  });

  it("gives nothing without either capability", () => {
    expect(canWorkOnTask(reader, "me", "me")).toBe(false);
  });
});
