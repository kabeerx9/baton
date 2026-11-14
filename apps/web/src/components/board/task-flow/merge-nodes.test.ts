import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vite-plus/test";
import { mergeNodes } from "./merge-nodes";

type Data = { title: string };
type Pill = Node<Data, "task">;

const pill = (id: string, title: string, extra: Partial<Pill> = {}): Pill => ({
  id,
  type: "task",
  position: { x: 0, y: 0 },
  data: { title },
  ...extra,
});

describe("mergeNodes", () => {
  it("keeps what React Flow measured and where the node was dragged", () => {
    const current = [
      pill("a", "Old", {
        position: { x: 120, y: 40 },
        measured: { width: 262, height: 48 },
      }),
    ];
    const [merged] = mergeNodes(current, [
      pill("a", "New", { position: { x: 0, y: 0 } }),
    ]);
    expect(merged.data).toEqual({ title: "New" });
    expect(merged.measured).toEqual({ width: 262, height: 48 });
    expect(merged.position).toEqual({ x: 120, y: 40 });
  });

  it("adds a new node at the position it was given", () => {
    const merged = mergeNodes(
      [pill("a", "A", { measured: { width: 10, height: 10 } })],
      [pill("a", "A"), pill("b", "B", { position: { x: 300, y: 90 } })],
    );
    expect(merged.map((node) => node.id)).toEqual(["a", "b"]);
    expect(merged[1].position).toEqual({ x: 300, y: 90 });
    expect(merged[1].measured).toBeUndefined();
  });

  it("drops a node that is no longer in the data", () => {
    const merged = mergeNodes(
      [pill("a", "A"), pill("b", "B")],
      [pill("b", "B")],
    );
    expect(merged.map((node) => node.id)).toEqual(["b"]);
  });

  it("keeps the rest of a kept node, such as its selection", () => {
    const [merged] = mergeNodes(
      [pill("a", "A", { selected: true })],
      [pill("a", "B")],
    );
    expect(merged.selected).toBe(true);
  });
});
