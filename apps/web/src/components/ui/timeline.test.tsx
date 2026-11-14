import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vite-plus/test";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "./timeline";

type TimelineProps = React.ComponentProps<typeof Timeline>;

function renderTimeline(props: TimelineProps = {}) {
  return render(
    <Timeline aria-label="Activity" {...props}>
      <TimelineItem aria-label="created" step={1}>
        <TimelineHeader>
          <TimelineDate dateTime="2026-11-14">Nov 14</TimelineDate>
          <TimelineTitle>Created</TimelineTitle>
        </TimelineHeader>
        <TimelineContent>Rohan created the task</TimelineContent>
        <TimelineIndicator />
        <TimelineSeparator />
      </TimelineItem>
      <TimelineItem aria-label="moved" step={2}>
        <TimelineHeader>
          <TimelineDate dateTime="2026-11-15">Nov 15</TimelineDate>
          <TimelineTitle>Moved</TimelineTitle>
        </TimelineHeader>
        <TimelineContent>Rohan moved it to Done</TimelineContent>
        <TimelineIndicator />
        <TimelineSeparator />
      </TimelineItem>
    </Timeline>,
  );
}

function items(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="timeline-item"]'),
  );
}

describe("Timeline", () => {
  it("renders every part with its slot, a fixed time element and a title", () => {
    const { container } = renderTimeline();

    const root = container.querySelector<HTMLElement>('[data-slot="timeline"]');
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByLabelText("Activity")).toBe(root);

    for (const slot of [
      "timeline-header",
      "timeline-content",
      "timeline-indicator",
      "timeline-separator",
      "timeline-date",
      "timeline-title",
    ]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }

    const date = screen.getByText("Nov 14");
    expect(date.tagName).toBe("TIME");
    expect(date).toHaveAttribute("datetime", "2026-11-14");

    const title = screen.getByText("Created");
    expect(title.tagName).toBe("H3");

    expect(screen.getByText("Rohan created the task")).toBeInTheDocument();
  });

  it("marks items up to the default active step as completed", () => {
    const { container } = renderTimeline();

    const [created, moved] = items(container);
    expect(created).toHaveAttribute("data-completed", "true");
    expect(moved).not.toHaveAttribute("data-completed");
  });

  it("marks items from a controlled value", () => {
    const { container } = renderTimeline({ value: 2 });

    for (const item of items(container)) {
      expect(item).toHaveAttribute("data-completed", "true");
    }
  });

  it("leaves every item incomplete when the step is past the value", () => {
    const { container } = renderTimeline({ value: 0 });

    for (const item of items(container)) {
      expect(item).not.toHaveAttribute("data-completed");
    }
  });

  it("uses the horizontal orientation when asked", () => {
    const { container } = renderTimeline({ orientation: "horizontal" });

    expect(container.querySelector('[data-slot="timeline"]')).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
  });

  it("merges the caller's class name and forwards attributes", () => {
    const { container } = renderTimeline({ className: "caller-class" });

    const root = container.querySelector('[data-slot="timeline"]');
    expect(root).toHaveClass("caller-class");
    expect(root).toHaveClass("group/timeline");
    expect(screen.getByLabelText("created")).toBe(items(container)[0]);
  });
});
