import { type RefObject, useLayoutEffect, useState } from "react";

export type NodeEdge = { from: string; to: string };
export type EdgeShape = { id: string; d: string };

/**
 * Draws a curve between nodes marked `data-node`, measured from the DOM so the
 * map can stay a plain responsive grid. An edge whose node is not on screen is
 * left out. Measure again whenever the wrapper changes size.
 */
export function useEdgePaths(
  wrap: RefObject<HTMLElement | null>,
  edges: NodeEdge[],
) {
  const [shape, setShape] = useState<{
    width: number;
    height: number;
    paths: EdgeShape[];
  }>({ width: 0, height: 0, paths: [] });

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const rect = (key: string) => {
        const node = el.querySelector(`[data-node="${key}"]`);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return {
          left: r.left - box.left,
          right: r.right - box.left,
          top: r.top - box.top,
          bottom: r.bottom - box.top,
        };
      };
      const paths: EdgeShape[] = [];
      for (const edge of edges) {
        const a = rect(edge.from);
        const b = rect(edge.to);
        if (!a || !b) continue;
        const acy = (a.top + a.bottom) / 2;
        const bcy = (b.top + b.bottom) / 2;
        const acx = (a.left + a.right) / 2;
        const bcx = (b.left + b.right) / 2;
        let d: string;
        if (b.left > a.right + 6) {
          const mid = (a.right + b.left) / 2;
          d = `M${a.right},${acy} C${mid},${acy} ${mid},${bcy} ${b.left - 2},${bcy}`;
        } else if (a.left > b.right + 6) {
          const mid = (a.left + b.right) / 2;
          d = `M${a.left},${acy} C${mid},${acy} ${mid},${bcy} ${b.right + 2},${bcy}`;
        } else if (b.top > a.bottom) {
          const mid = (a.bottom + b.top) / 2;
          d = `M${acx},${a.bottom} C${acx},${mid} ${bcx},${mid} ${bcx},${b.top - 2}`;
        } else {
          const mid = (a.top + b.bottom) / 2;
          d = `M${acx},${a.top} C${acx},${mid} ${bcx},${mid} ${bcx},${b.bottom + 2}`;
        }
        paths.push({ id: `${edge.from}>${edge.to}`, d });
      }
      setShape({ width: box.width, height: box.height, paths });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [wrap, edges]);

  return shape;
}
