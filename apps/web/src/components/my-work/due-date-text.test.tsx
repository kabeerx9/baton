import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { DueDateLabel, DueDateText } from "./due-date-text";

vi.mock("react-i18next", async (original) => ({
  ...(await original<object>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("updates relative due-date text at midnight with unchanged props", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2030, 0, 1, 23, 59, 59));
  render(<DueDateText dueDate={new Date(2030, 0, 2, 12).toISOString()} />);
  expect(screen.getByText("workspace:myWork.due.tomorrow")).toBeVisible();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("workspace:myWork.due.today")).toBeVisible();
});

it("shows the text for the day it is given, with no timer of its own", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2030, 0, 1, 12));
  const due = new Date(2030, 0, 2, 12).toISOString();
  const { rerender } = render(
    <DueDateLabel dueDate={due} day={new Date(2030, 0, 1).getTime()} />,
  );
  expect(screen.getByText("workspace:myWork.due.tomorrow")).toBeVisible();
  expect(vi.getTimerCount()).toBe(0);
  rerender(<DueDateLabel dueDate={due} day={new Date(2030, 0, 2).getTime()} />);
  expect(screen.getByText("workspace:myWork.due.today")).toBeVisible();
});
