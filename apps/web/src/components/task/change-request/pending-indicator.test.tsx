import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { pendingOn } from "@/components/board/model";
import {
  boardTaskFixture,
  subtaskFixture,
} from "@/components/board/test-fixtures";
import type { PendingRequest } from "./describe-pending";
import { PendingIndicator } from "./pending-indicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

afterEach(cleanup);

const request: PendingRequest = {
  id: "r1",
  kind: "status",
  targetStatus: "done",
  requestedBy: "rohan",
  channel: "agent",
  expiresAt: "2026-11-15T09:00:00.000Z",
};

describe("PendingIndicator", () => {
  it("says a request is pending and who asked for what", () => {
    render(<PendingIndicator request={request} requesterName="Rohan" />);
    const marker = screen.getByRole("img");
    expect(marker.textContent).toBe("tasks:changeRequest.pending");
    const label = marker.getAttribute("aria-label") ?? "";
    expect(label).toContain("tasks:changeRequest.pending:");
    expect(label).toContain("tasks:changeRequest.pendingStatus");
    expect(label).toContain("tasks:changeRequest.withAgent");
    expect(label).toContain("Rohan");
  });

  it("describes a delete and an unknown requester", () => {
    render(
      <PendingIndicator
        request={{
          ...request,
          kind: "delete",
          targetStatus: null,
          channel: "web",
        }}
        requesterName={null}
      />,
    );
    const label = screen.getByRole("img").getAttribute("aria-label") ?? "";
    expect(label).toContain("tasks:changeRequest.pendingDelete");
    expect(label).toContain("tasks:changeRequest.someone");
  });

  it("keeps a click on the tooltip away from the card link around it", async () => {
    const onCardClick = vi.fn();
    const { container } = render(
      <a
        href="/elsewhere"
        onClick={(event) => {
          event.preventDefault();
          onCardClick();
        }}
      >
        <span>Card title</span>
        <PendingIndicator request={request} requesterName="Rohan" />
      </a>,
    );

    // Base UI opens on mouseenter, UI SDK on pointerenter; the tooltip waits
    // 600ms after the pointer rests on the trigger.
    const marker = screen.getByRole("img");
    fireEvent.pointerOver(marker, { pointerType: "mouse" });
    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    fireEvent.mouseOver(marker);
    fireEvent.mouseEnter(marker);
    fireEvent.mouseMove(marker, { movementX: 5, movementY: 5 });

    const content = await waitFor(
      () => {
        const open = [
          ...document.querySelectorAll('[data-slot="tooltip-content"]'),
        ].find((element) => element.hasAttribute("data-open"));
        if (!open) throw new Error("tooltip did not open");
        return open;
      },
      { timeout: 2500 },
    );

    // The popup renders in a container outside the link, and a click on it
    // stops there instead of reaching the card.
    expect(container.querySelector("a")?.contains(content)).toBe(false);
    fireEvent.click(content);
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Card title"));
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });
});

describe("pendingOn", () => {
  it("prefers the task's own request, then the first on a subtask, else none", () => {
    const own = boardTaskFixture("a", { pendingRequest: request });
    const viaSubtask = boardTaskFixture("b", {
      subtasks: [
        subtaskFixture("s1"),
        subtaskFixture("s2", { pendingRequest: { ...request, id: "r2" } }),
      ],
    });
    expect(pendingOn(own)?.id).toBe("r1");
    expect(pendingOn(viaSubtask)?.id).toBe("r2");
    expect(pendingOn(boardTaskFixture("c"))).toBeNull();
  });
});
