import type { Dispatch } from "react";
import type { TaskView } from "./derive";
import type { TaskAction } from "./task-state";
import type { TaskDetail, Viewer } from "./types";

/** What every variant receives. They present the view; the reducer changes it. */
export type PageProps = {
  task: TaskDetail;
  view: TaskView;
  viewer: Viewer;
  dispatch: Dispatch<TaskAction>;
};
