export type Shard = {
  id: number;
  /** Triangle corners as percentages of the screen. */
  points: [number, number][];
  /** Triangle center, the transform origin, in percent. */
  origin: [number, number];
  /** Fall offset in vh/vw units and spin in degrees. */
  dx: number;
  dy: number;
  rotate: number;
  /** Seconds before this shard lets go. */
  delay: number;
};

/** Small seeded generator, so a layout is the same every run and testable. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cuts the screen into triangles on a jittered grid. They share edges, so
 * together they cover every pixel. Shards near the top let go first.
 */
export function makeShards(cols = 5, rows = 4, seed = 7): Shard[] {
  const rand = mulberry32(seed);
  const grid: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols;
      const jx = edge && (c === 0 || c === cols) ? 0 : (rand() - 0.5) * 0.6;
      const jy = edge && (r === 0 || r === rows) ? 0 : (rand() - 0.5) * 0.6;
      row.push([((c + jx) / cols) * 100, ((r + jy) / rows) * 100]);
    }
    grid.push(row);
  }

  const shards: Shard[] = [];
  const add = (points: [number, number][]) => {
    const cx = points.reduce((sum, p) => sum + p[0], 0) / 3;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / 3;
    shards.push({
      id: shards.length,
      points,
      origin: [cx, cy],
      dx: (rand() - 0.5) * 30 + (cx - 50) * 0.25,
      dy: 110 + rand() * 40,
      rotate: (rand() - 0.5) * 70,
      delay: (cy / 100) * 0.25 + rand() * 0.2,
    });
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r]![c]!;
      const b = grid[r]![c + 1]!;
      const d = grid[r + 1]![c]!;
      const e = grid[r + 1]![c + 1]!;
      if (rand() < 0.5) {
        add([a, b, e]);
        add([a, e, d]);
      } else {
        add([a, b, d]);
        add([b, e, d]);
      }
    }
  }
  return shards;
}

export function clipPath(points: [number, number][]) {
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;
}
