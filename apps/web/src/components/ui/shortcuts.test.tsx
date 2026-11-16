import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { useShortcut, useShortcutHint } from "./shortcuts";

function Probe({ onKey }: { onKey: () => void }) {
  useShortcut("j", onKey, { description: "Probe" });
  const hint = useShortcutHint("j");
  return <kbd>{hint.text}</kbd>;
}

describe("shortcuts", () => {
  it("runs the handler on the key and shows the hint", () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    expect(screen.getByText(/j/i)).toBeTruthy();
    act(() => {
      fireEvent.keyDown(document.body, { key: "j" });
    });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it("does not run while someone types in a field", () => {
    const onKey = vi.fn();
    render(
      <>
        <Probe onKey={onKey} />
        <input aria-label="note" />
      </>,
    );
    act(() => {
      fireEvent.keyDown(screen.getByLabelText("note"), { key: "j" });
    });
    expect(onKey).not.toHaveBeenCalled();
  });
});
