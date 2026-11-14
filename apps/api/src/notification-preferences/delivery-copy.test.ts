import { describe, expect, it } from "vite-plus/test";
import { getDeliveryContent } from "./delivery-copy";

describe("getDeliveryContent", () => {
  it("fills the English copy for an event", () => {
    expect(getDeliveryContent("task_overdue", { taskTitle: "A" })).toEqual({
      title: "Task overdue",
      body: "A is past its due date",
    });
  });

  it("labels statuses and the reminder lead time", () => {
    expect(
      getDeliveryContent("task_status_changed", {
        taskTitle: "A",
        oldStatus: "to-do",
        newStatus: "custom_col",
      })?.body,
    ).toBe('Task "A" status changed from "To Do" to "Custom Col"');
    expect(
      getDeliveryContent("due_date_reminder", {
        taskTitle: "A",
        leadTimeMinutes: 120,
      })?.body,
    ).toBe("A is due in 2 hours");
    expect(
      getDeliveryContent("due_date_reminder", {
        taskTitle: "A",
        leadTimeMinutes: 60,
      })?.body,
    ).toBe("A is due in 1 hour");
  });

  it.each([null, undefined, "", "   "])(
    "names an unnamed mention author Someone (%j)",
    (mentionerName) => {
      expect(
        getDeliveryContent("task_mention", { mentionerName, taskTitle: "A" })
          ?.title,
      ).toBe("Someone mentioned you");
    },
  );

  it("keeps a named author", () => {
    expect(
      getDeliveryContent("task_mention", {
        mentionerName: "Ada",
        taskTitle: "A",
      })?.title,
    ).toBe("Ada mentioned you");
  });

  it("returns null when another required placeholder is missing", () => {
    expect(
      getDeliveryContent("task_mention", {
        mentionerName: "Ada",
        taskTitle: null,
      }),
    ).toBeNull();
  });

  it("returns null for types without copy", () => {
    expect(getDeliveryContent("custom", {})).toBeNull();
    expect(getDeliveryContent("constructor", { taskTitle: "A" })).toBeNull();
  });

  it("treats a column slug named like an object key as a custom column", () => {
    expect(
      getDeliveryContent("task_status_changed", {
        taskTitle: "A",
        oldStatus: "to-do",
        newStatus: "constructor",
      })?.body,
    ).toBe('Task "A" status changed from "To Do" to "Constructor"');
  });
});
