import { describe, expect, it } from "vite-plus/test";
import { recoveryText, type Say } from "./recovery-text";

// Echo the key and values so the test shows what the board asks for.
const say: Say = (key, values) =>
  values ? `${key} ${JSON.stringify(values)}` : key;

describe("recoveryText", () => {
  it("names the card and its new column when it moved", () => {
    expect(
      recoveryText(
        {
          key: "id1",
          label: "T-5",
          to: "id1",
          column: "review",
          reason: "moved",
        },
        say,
      ),
    ).toBe(
      'workspace:board.nav.moved {"key":"T-5","column":"workspace:board.columns.review"}',
    );
  });

  it("says the card is gone when it was removed", () => {
    expect(
      recoveryText(
        {
          key: "id1",
          label: "T-5",
          to: "id2",
          column: "todo",
          reason: "removed",
        },
        say,
      ),
    ).toBe('workspace:board.nav.removed {"key":"T-5"}');
  });

  it("says the card is gone even when no card is left", () => {
    expect(
      recoveryText(
        { key: "id1", label: "T-5", to: null, column: null, reason: "removed" },
        say,
      ),
    ).toBe('workspace:board.nav.removed {"key":"T-5"}');
  });

  it("says nothing for a move with no known column", () => {
    expect(
      recoveryText(
        { key: "id1", label: "T-5", to: "id1", column: null, reason: "moved" },
        say,
      ),
    ).toBeNull();
  });
});
