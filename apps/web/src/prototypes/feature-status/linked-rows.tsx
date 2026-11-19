import type { LinkedTask } from "@/components/board/task-flow/linked";
import { LinkedRow } from "./linked-row";

/** Links to other features, as rows that match the task rows. */
export function LinkedRows({
  waitsOn,
  blocks,
}: {
  waitsOn: LinkedTask[];
  blocks: LinkedTask[];
}) {
  return (
    <>
      {waitsOn.map((x) => (
        <LinkedRow key={x.id} item={x} verb="Waits on" />
      ))}
      {blocks.map((x) => (
        <LinkedRow key={x.id} item={x} verb="Holds up" />
      ))}
    </>
  );
}
