import { Board } from "./board";
import type { PageId } from "./copy";
import { TaskDetail } from "./task-detail";

export function PageBody({ page }: { page: PageId }) {
  return page === "task" ? <TaskDetail /> : <Board />;
}
