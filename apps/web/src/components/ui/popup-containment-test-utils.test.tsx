import { fireEvent, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vite-plus/test";

import { containPopupEvents } from "./popup-containment";
import {
  expectPopupContainment,
  type PopupContainmentCase,
} from "./popup-containment-test-utils";

type Opener = "click" | "context-menu" | "keyboard";

/**
 * A popup the helper checks: a trigger that opens a content part, standing in
 * for a menu or a context menu. `contained: false` is a wrapper that never
 * applied the helper, which the checks must catch.
 */
function ProbePopup({
  containEvents,
  contained = true,
  contentProps,
  control,
}: {
  containEvents: boolean;
  contained?: boolean;
  contentProps: { onClick: (event: React.MouseEvent) => void };
  control: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const openNow = () => setOpen(true);
  const content = {
    ...(contained
      ? containPopupEvents(contentProps, containEvents)
      : contentProps),
    "data-testid": "test-content",
  };

  return (
    <div>
      <button
        onClick={openNow}
        onContextMenu={(event) => {
          event.preventDefault();
          openNow();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") openNow();
        }}
        type="button"
      >
        Open
      </button>
      {open ? <div {...content}>{control}</div> : null}
    </div>
  );
}

function openerCase(opener: Opener, contained = true): PopupContainmentCase {
  return {
    render: (options) => <ProbePopup contained={contained} {...options} />,
    open: async () => {
      const trigger = screen.getByRole("button", { name: "Open" });
      if (opener === "click") fireEvent.click(trigger);
      if (opener === "context-menu") fireEvent.contextMenu(trigger);
      if (opener === "keyboard") fireEvent.keyDown(trigger, { key: "Enter" });
      await screen.findByTestId("test-content");
    },
    content: () => screen.getByTestId("test-content"),
  };
}

describe("expectPopupContainment", () => {
  // Opening is an interaction on the probe, so the opener's own click, context
  // click or keystroke lands in the spies the checks assert on afterwards.
  it("passes a popup opened by a click", async () => {
    await expectPopupContainment(openerCase("click"));
  });

  it("passes a popup opened by a context click", async () => {
    await expectPopupContainment(openerCase("context-menu"));
  });

  it("passes a popup opened by the keyboard", async () => {
    await expectPopupContainment(openerCase("keyboard"));
  });

  it("fails a popup that does not contain its events", async () => {
    await expect(
      expectPopupContainment(openerCase("click", false)),
    ).rejects.toThrow("reached its ancestor");
  });
});
