import { MotionConfig } from "motion/react";
import "./prototype.css";
import { useCallback, useMemo, useState } from "react";
import { deriveTaskView } from "./derive";
import { PrototypeToolbar } from "./prototype-toolbar";
import { Picker } from "./picker";
import { useTaskState, VIEWERS, type ViewerId } from "./use-task-state";
import { VARIANTS } from "./variants";
import type { DataSetId } from "./types";

export type PrototypeSearch = { v: number; d: DataSetId; u: ViewerId };

type Props = {
  search: PrototypeSearch;
  onSearch: (next: Partial<PrototypeSearch>) => void;
};

/** One data set mounted under one reducer. Remounts when the data set changes. */
function Stage({
  dataSet,
  viewerId,
  variant,
  replay,
}: {
  dataSet: DataSetId;
  viewerId: ViewerId;
  variant: number;
  replay: number;
}) {
  const { task, dispatch } = useTaskState(dataSet);
  const viewer = VIEWERS[viewerId];
  const view = useMemo(() => deriveTaskView(task, viewer), [task, viewer]);
  const Variant = VARIANTS[variant]?.Component ?? VARIANTS[0]!.Component;
  return (
    <>
      <PrototypeToolbar
        task={task}
        dispatch={dispatch}
        view={view}
        dataSet={dataSet}
        viewerId={viewerId}
      />
      <Variant
        key={`${variant}-${replay}`}
        task={task}
        view={view}
        viewer={viewer}
        dispatch={dispatch}
      />
    </>
  );
}

export function TaskDetailPrototype({ search, onSearch }: Props) {
  const [replay, setReplay] = useState(0);
  const variant = Math.min(Math.max(search.v - 1, 0), VARIANTS.length - 1);
  const names = useMemo(() => VARIANTS.map((v) => v.name), []);
  const onChange = useCallback(
    (i: number) => onSearch({ v: i + 1 }),
    [onSearch],
  );
  const onReplay = useCallback(() => setReplay((n) => n + 1), []);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="h-svh w-full overflow-y-auto bg-background text-foreground"
        data-prototype="task-detail"
      >
        <Stage
          key={`${search.d}-${search.u}`}
          dataSet={search.d}
          viewerId={search.u}
          variant={variant}
          replay={replay}
        />
        <div className="h-24" aria-hidden="true" />
      </div>
      <Picker
        names={names}
        active={variant}
        onChange={onChange}
        onReplay={onReplay}
      />
    </MotionConfig>
  );
}
