import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

// Every popup that scales or slides on enter and exit must answer to the
// reduced-motion rule in index.css, which keeps the fade and drops movement.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const block = css.slice(
  css.indexOf("@media (prefers-reduced-motion: reduce)"),
  css.indexOf("@theme inline"),
);

describe("Reduced motion for popup slots", () => {
  it.each([
    "popover-content",
    "select-content",
    "menu-content",
    "tooltip-content",
    "hover-card-content",
    "dialog-content",
    "alert-dialog-content",
    "toast",
  ])("covers %s", (slot) => {
    expect(block).toContain(`[data-slot="${slot}"]`);
  });

  it("negative control: an unknown slot is not covered", () => {
    expect(block).not.toContain('[data-slot="hover-card-fake"]');
  });
});
