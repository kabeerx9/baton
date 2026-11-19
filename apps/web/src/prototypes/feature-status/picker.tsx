import * as React from "react";

const CSS = `
.proto-picker{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(10,10,10,.82);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 8px 24px rgba(0,0,0,.24),0 2px 6px rgba(0,0,0,.12);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
.proto-picker-highlight{position:absolute;top:4px;left:0;height:28px;border-radius:999px;background:rgba(255,255,255,.12)}
.proto-picker[data-ready] .proto-picker-highlight{transition:transform 250ms cubic-bezier(.23,1,.32,1),width 250ms cubic-bezier(.23,1,.32,1)}
@media (prefers-reduced-motion:reduce){.proto-picker[data-ready] .proto-picker-highlight{transition:none}}
.proto-picker-item{position:relative;display:flex;align-items:center;height:28px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.55);font:inherit;cursor:pointer;transition:color 150ms ease-out,transform 160ms cubic-bezier(.23,1,.32,1)}
@media (hover:hover) and (pointer:fine){.proto-picker-item:hover{color:rgba(255,255,255,.85)}}
.proto-picker-item:active{transform:scale(.97)}
.proto-picker-item:focus-visible{outline:2px solid rgba(255,255,255,.4);outline-offset:2px}
.proto-picker-item[data-active]{color:#fff}
.proto-picker-divider{width:1px;height:16px;margin:0 4px;background:rgba(255,255,255,.12)}
.proto-picker-replay{padding:0 10px;font-size:14px}
`;

export function Picker({
  names,
  current,
  onSelect,
  onReplay,
}: {
  names: string[];
  current: number;
  onSelect: (i: number) => void;
  onReplay: () => void;
}) {
  const nav = React.useRef<HTMLElement>(null);
  const items = React.useRef<(HTMLButtonElement | null)[]>([]);
  const highlight = React.useRef<HTMLSpanElement>(null);
  const [ready, setReady] = React.useState(false);

  const move = React.useCallback(() => {
    const el = items.current[current];
    const h = highlight.current;
    if (!el || !h) return;
    h.style.width = `${el.offsetWidth}px`;
    h.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  React.useLayoutEffect(move, [move]);
  React.useEffect(() => {
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [move]);
  React.useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= names.length) onSelect(n - 1);
      else if (e.key === "ArrowRight") onSelect((current + 1) % names.length);
      else if (e.key === "ArrowLeft")
        onSelect((current - 1 + names.length) % names.length);
      else if (e.key === "r" || e.key === "R") onReplay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, names.length, onSelect, onReplay]);

  return (
    <>
      <style>{CSS}</style>
      <nav
        ref={nav}
        className="proto-picker"
        aria-label="Prototype variants"
        data-ready={ready ? "" : undefined}
      >
        <span
          ref={highlight}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {names.map((n, i) => (
          <button
            key={n}
            ref={(el) => {
              items.current[i] = el;
            }}
            type="button"
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => onSelect(i)}
          >
            {n}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={onReplay}
        >
          ↻
        </button>
      </nav>
    </>
  );
}
