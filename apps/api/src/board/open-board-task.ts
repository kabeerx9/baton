import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  columnTable,
  projectTable,
  taskRelationTable,
  taskTable,
} from "../database/schema";
import { taskIsCompleted } from "../task/task-is-completed";

const child = alias(taskTable, "board_child");
const childColumn = alias(columnTable, "board_child_column");

/** True when the task in scope is a board task that has at least one subtask. */
export const isBoardParent = sql<boolean>`(
  ${projectTable.kind} = 'board' and exists (
    select 1 from ${taskRelationTable}
    where ${taskRelationTable.sourceTaskId} = ${taskTable.id}
      and ${taskRelationTable.relationType} = 'subtask'
  )
)`;

/**
 * True when at least one subtask of the task in scope is not finished.
 * A board task with subtasks is open exactly as long as this holds: its own
 * stored status is ignored, the same rule the board column uses.
 */
export const hasOpenSubtask = sql<boolean>`exists (
  select 1 from ${taskRelationTable}
  inner join ${taskTable} as ${child} on ${child.id} = ${taskRelationTable.targetTaskId}
  where ${taskRelationTable.sourceTaskId} = ${taskTable.id}
    and ${taskRelationTable.relationType} = 'subtask'
    and not exists (
      select 1 from ${columnTable} as ${childColumn}
      where ${childColumn.projectId} = ${child.projectId}
        and ${childColumn.slug} = ${child.status}
        and ${childColumn.isFinal} = true
    )
)`;

/**
 * True while the task in scope still holds up the work that waits on it.
 * An archived task, or one in an archived project, is never open. A board task
 * with subtasks is open while one of them is open (rule 3); every other task
 * is open until it reaches a final column. The waits-on badge, the "waiting"
 * list and the refusal to finish a blocked task all use this one predicate.
 * Needs `taskTable` and its `projectTable` row in scope.
 */
export const taskIsOpen = sql<boolean>`(
  ${taskTable.status} <> 'archived'
  and ${projectTable.archivedAt} is null
  and case when ${isBoardParent} then ${hasOpenSubtask} else not ${taskIsCompleted} end
)`;
