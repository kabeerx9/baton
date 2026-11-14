export type Box = { x: number; y: number; width: number; height: number };

/** The smallest zoom the map starts at. Below this the text is too small. */
export const MIN_START_ZOOM = 0.85;
const MAX_START_ZOOM = 1;
const PADDING = 24;

/**
 * Where the map starts. It fits the graph into the canvas, but never zooms out
 * past MIN_START_ZOOM. If the graph is then wider than the canvas, its left
 * edge (the feature) sits at the canvas edge and people pan right. If it is
 * taller, its top edge does the same.
 */
export function initialViewport(
  graph: Box,
  canvas: { width: number; height: number },
) {
  const fit = Math.min(
    (canvas.width - PADDING * 2) / graph.width,
    (canvas.height - PADDING * 2) / graph.height,
  );
  const zoom = Math.min(
    MAX_START_ZOOM,
    Math.max(MIN_START_ZOOM, Number.isFinite(fit) ? fit : MAX_START_ZOOM),
  );
  const place = (size: number, canvasSize: number, start: number) => {
    const scaled = size * zoom;
    const offset =
      scaled + PADDING * 2 > canvasSize ? PADDING : (canvasSize - scaled) / 2;
    return offset - start * zoom;
  };
  return {
    zoom,
    x: place(graph.width, canvas.width, graph.x),
    y: place(graph.height, canvas.height, graph.y),
  };
}

/** The box around a set of placed nodes. */
export function boundsOf(
  placed: ReadonlyMap<string, { x: number; y: number }>,
  sizes: ReadonlyMap<string, { width: number; height: number }>,
): Box {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [id, at] of placed) {
    const size = sizes.get(id) ?? { width: 0, height: 0 };
    minX = Math.min(minX, at.x);
    minY = Math.min(minY, at.y);
    maxX = Math.max(maxX, at.x + size.width);
    maxY = Math.max(maxY, at.y + size.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
