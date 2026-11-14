import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./prototype.css";

type ProtoPickerProps = {
  names: string[];
  active: number;
  onChange: (index: number) => void;
  onReplay: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
  );
}

/** Floating variant picker. Markup, styles and keys follow the prototype skill's PICKER.md. */
export function ProtoPicker({
  names,
  active,
  onChange,
  onReplay,
}: ProtoPickerProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = itemRefs.current[active];
    const highlight = highlightRef.current;
    if (!el || !highlight) return;
    const move = () => {
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [active]);

  useEffect(() => {
    // Enable the slide only after first paint, so load does not animate.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= names.length) onChange(num - 1);
      else if (e.key === "ArrowRight") onChange((active + 1) % names.length);
      else if (e.key === "ArrowLeft")
        onChange((active - 1 + names.length) % names.length);
      else if (e.key === "r" || e.key === "R") onReplay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, names.length, onChange, onReplay]);

  return (
    <nav
      aria-label="Prototype variants"
      className="proto-picker"
      data-ready={ready ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className="proto-picker-highlight"
        ref={highlightRef}
      />
      {names.map((name, i) => (
        <button
          aria-current={i === active ? "true" : undefined}
          className="proto-picker-item"
          data-active={i === active ? "" : undefined}
          key={name}
          onClick={() => onChange(i)}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
        >
          {name}
        </button>
      ))}
      <span aria-hidden="true" className="proto-picker-divider" />
      <button
        aria-label="Replay animation (R)"
        className="proto-picker-item proto-picker-replay"
        onClick={onReplay}
        type="button"
      >
        ↻
      </button>
    </nav>
  );
}
