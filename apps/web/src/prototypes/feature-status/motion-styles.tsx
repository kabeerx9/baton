/**
 * Entrance motion for the variants, as CSS so reduced motion switches it off in
 * one place. All easing is a strong ease-out; nothing runs longer than 400ms.
 */
const CSS = `
@keyframes fs-grow{from{transform:scaleX(0);opacity:0}to{transform:none;opacity:1}}
@keyframes fs-rise{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
@keyframes fs-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.fs-grow{transform-origin:left center;animation:fs-grow 380ms cubic-bezier(.23,1,.32,1) both}
.fs-rise{animation:fs-rise 260ms cubic-bezier(.23,1,.32,1) both}
.fs-draw{stroke-dasharray:1;animation:fs-draw 420ms cubic-bezier(.23,1,.32,1) both}
@media (prefers-reduced-motion:reduce){.fs-grow,.fs-rise,.fs-draw{animation:none}}
`;

export function MotionStyles() {
  return <style>{CSS}</style>;
}
