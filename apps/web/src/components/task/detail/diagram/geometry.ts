/** Fixed node size so one SVG can draw every curve to the core. */
export const NODE_H = 76;
export const NODE_GAP = 10;
export const MAX_NODES = 3;

export const columnHeight = (n: number) =>
  Math.max(n, 1) * NODE_H + (Math.max(n, 1) - 1) * NODE_GAP;

export const nodeCenter = (i: number) => i * (NODE_H + NODE_GAP) + NODE_H / 2;
