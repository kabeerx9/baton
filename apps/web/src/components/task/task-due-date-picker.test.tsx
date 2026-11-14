import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskDueDatePicker from "./task-due-date-picker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

describe("TaskDueDatePicker", () => {
  it("offers to clear a set due date and has no repeat controls", () => {
    render(
      <TaskDueDatePicker
        label="Due date"
        clearLabel="Clear date"
        dueDate={new Date("2026-03-10T00:00:00Z")}
        onDateChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Clear date")).toBeInTheDocument();
    expect(
      screen.queryByText("tasks:popover.recurrence.toggle"),
    ).not.toBeInTheDocument();
  });
});
