import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./picker.css";

type VariantPickerProps = {
  labels: readonly string[];
  current: number;
  onSelect: (index: number) => void;
  onReplay: () => void;
};

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

/** The prototype skill's picker, per PICKER.md. Harness chrome, not a contestant. */
export function VariantPicker({
  labels,
  current,
  onSelect,
  onReplay,
}: VariantPickerProps) {
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ready, setReady] = useState(false);

  const move = () => {
    const el = itemRefs.current[current];
    const highlight = highlightRef.current;
    if (!el || !highlight) return;
    highlight.style.width = `${el.offsetWidth}px`;
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  };

  useLayoutEffect(move);
  useEffect(() => {
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  });
  // The slide is enabled only after first paint, so load does not animate.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (TYPING.test(target.tagName) || target.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= labels.length) onSelect(num - 1);
      else if (e.key === "ArrowRight") onSelect((current + 1) % labels.length);
      else if (e.key === "ArrowLeft")
        onSelect((current - 1 + labels.length) % labels.length);
      else if (e.key === "r" || e.key === "R") onReplay();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current, labels.length, onSelect, onReplay]);

  return (
    <nav
      ref={navRef}
      className="proto-picker"
      aria-label="Prototype variants"
      data-ready={ready ? "" : undefined}
    >
      <span
        ref={highlightRef}
        className="proto-picker-highlight"
        aria-hidden="true"
      />
      {labels.map((label, i) => (
        <button
          key={label}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="proto-picker-item"
          type="button"
          data-active={i === current ? "" : undefined}
          aria-current={i === current ? "true" : undefined}
          onClick={() => onSelect(i)}
        >
          {label}
        </button>
      ))}
      <span className="proto-picker-divider" aria-hidden="true" />
      <button
        className="proto-picker-item proto-picker-replay"
        type="button"
        aria-label="Replay animation (R)"
        onClick={onReplay}
      >
        ↻
      </button>
    </nav>
  );
}
