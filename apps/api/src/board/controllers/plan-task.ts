import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import updateTaskAssignee from "../../task/controllers/update-task-assignee";
import updateTaskStatus from "../../task/controllers/update-task-status";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { decideConsent } from "../../task-change-request/consent";
import { loadConsentFacts } from "../../task-change-request/load-consent-facts";
import { consentError } from "../../task-change-request/request-change";
import type { ChangeRequestRow } from "../../task-change-request/response";
import { taskTable as tasks } from "../../database/schema";
import createTaskRelation from "../../task-relation/controllers/create-task-relation";
import {
  isKey,
  type Member,
  matchMember,
  matchRepo,
  type Named,
  parseTaskRef,
  type Repo,
  statusSlug,
  taskNotFound,
} from "../resolve-names";
import addSubtask from "./add-subtask";
import createBoardTask from "./create-board-task";
import { ensureBoardProject } from "./ensure-board-project";

export type SubtaskPlan = {
  title: string;
  description?: string;
  /** Repo key or name. Leave out, or say "none", for work with no repo. */
  repo?: string;
  /** A person's name, email or id. */
  owner?: string;
  status?: string;
  /**
   * What must be finished first. Each entry is a ticket key (API-3), the
   * title of another subtask in the same request, or its position (1 = first).
   */
  waitsOn?: (string | number)[];
};

type Caller = {
  workspaceId: string;
  currentUserId: string;
  /** How the caller acted; defaults to the current user as a person. */
  actor?: TaskActor;
};

function unwrap<T>(result: Named<T>): T {
  if (!result.ok) throw new HTTPException(400, { message: result.message });
  return result.value;
}

async function loadDirectory(workspaceId: string) {
  // The board project must exist before "no repo" can resolve to it.
  await ensureBoardProject(workspaceId);
  const [members, repos] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(workspaceUserTable.workspaceId, workspaceId)),
    db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        slug: projectTable.slug,
        kind: projectTable.kind,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
        ),
      ),
  ]);
  return { members, repos };
}

type Directory = { members: Member[]; repos: Repo[] };

/** A task in this workspace by its key (API-3) or by its id. */
export async function findTaskByKey(workspaceId: string, ref: string) {
  const parsed = parseTaskRef(ref);
  const [task] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      projectId: taskTable.projectId,
      slug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        "id" in parsed
          ? eq(taskTable.id, parsed.id)
          : and(
              sql`lower(${projectTable.slug}) = ${parsed.slug.toLowerCase()}`,
              eq(taskTable.number, parsed.number),
            ),
      ),
    )
    .limit(1);
  if (!task) throw taskNotFound(parsed.key);
  return task;
}

type Resolved = {
  plan: SubtaskPlan;
  repo: Repo;
  owner: Member | undefined;
  /** A blocker is an existing task id, or the position of a subtask in this request. */
  blockers: ({ taskId: string; key: string } | { index: number })[];
};

/**
 * Turns every name in the request into an id, and refuses the whole request
 * if one cannot be resolved. Nothing is created until this has passed, so a
 * typo does not leave half a task behind.
 */
async function resolveSubtasks(
  workspaceId: string,
  directory: Directory,
  plans: SubtaskPlan[],
): Promise<Resolved[]> {
  const titles = plans.map((p) => p.title.trim().toLowerCase());
  const resolved: Resolved[] = [];
  for (const [index, plan] of plans.entries()) {
    const blockers: Resolved["blockers"] = [];
    for (const ref of plan.waitsOn ?? []) {
      if (typeof ref === "string" && isKey(ref)) {
        const blocker = await findTaskByKey(workspaceId, ref);
        blockers.push({
          taskId: blocker.id,
          key: `${blocker.slug}-${blocker.number ?? "?"}`,
        });
        continue;
      }
      const position =
        typeof ref === "number"
          ? ref - 1
          : titles.indexOf(ref.trim().toLowerCase());
      if (position < 0 || position >= plans.length || position === index) {
        // Last chance: the id of an existing task.
        const byId =
          typeof ref === "string"
            ? await findTaskByKey(workspaceId, ref).catch(() => null)
            : null;
        if (byId) {
          blockers.push({
            taskId: byId.id,
            key: `${byId.slug}-${byId.number ?? "?"}`,
          });
          continue;
        }
        throw new HTTPException(400, {
          message: `"${plan.title}" waits on "${ref}", which is not a ticket key, a task id, the title of another task in this request, or a position from 1 to ${plans.length}.`,
        });
      }
      blockers.push({ index: position });
    }
    resolved.push({
      plan,
      repo: unwrap(matchRepo(directory.repos, plan.repo)),
      owner: plan.owner
        ? unwrap(matchMember(directory.members, plan.owner))
        : undefined,
      blockers,
    });
  }
  return resolved;
}

async function createSubtasks(
  caller: Caller,
  parentId: string,
  resolved: Resolved[],
) {
  const created = [];
  for (const item of resolved) {
    const task = await addSubtask({
      taskId: parentId,
      workspaceId: caller.workspaceId,
      currentUserId: caller.currentUserId,
      projectId: item.repo.id,
      title: item.plan.title.trim(),
      description: item.plan.description,
      userId: item.owner?.id,
      status: item.plan.status ? statusSlug(item.plan.status) : undefined,
    });
    created.push({
      id: task.id,
      key: `${item.repo.slug}-${task.number ?? "?"}`,
      title: task.title,
      repo: item.repo.kind === "board" ? null : item.repo.slug,
      owner: item.owner?.name ?? null,
      waitsOn: [] as string[],
    });
  }
  // Links come last: a subtask can wait on one that is later in the list.
  for (const [index, item] of resolved.entries()) {
    for (const blocker of item.blockers) {
      const blockerId =
        "taskId" in blocker ? blocker.taskId : created[blocker.index]?.id;
      const target = created[index];
      if (!blockerId || !target) continue;
      await createTaskRelation({
        sourceTaskId: blockerId,
        targetTaskId: target.id,
        relationType: "blocks",
        userId: caller.currentUserId,
        workspaceId: caller.workspaceId,
      });
      target.waitsOn.push(
        "taskId" in blocker
          ? blocker.key
          : (created[blocker.index]?.key ?? blockerId),
      );
    }
  }
  return created;
}

/** One request: a task, its subtasks, their owners and what waits on what. */
export async function createTaskPlan({
  title,
  description,
  owner,
  subtasks = [],
  ...caller
}: Caller & {
  title: string;
  description?: string;
  owner?: string;
  subtasks?: SubtaskPlan[];
}) {
  const directory = await loadDirectory(caller.workspaceId);
  const taskOwner = owner
    ? unwrap(matchMember(directory.members, owner))
    : undefined;
  const resolved = await resolveSubtasks(
    caller.workspaceId,
    directory,
    subtasks,
  );
  const board = unwrap(matchRepo(directory.repos, "none"));

  const task = await createBoardTask({
    ...caller,
    title: title.trim(),
    description,
    userId: taskOwner?.id,
  });
  return {
    id: task.id,
    key: `${board.slug}-${task.number ?? "?"}`,
    title: task.title,
    owner: taskOwner?.name ?? null,
    subtasks: await createSubtasks(caller, task.id, resolved),
  };
}

/** Adds subtasks to an existing task, by the same names as createTaskPlan. */
export async function addSubtaskPlans({
  taskKey,
  subtasks,
  ...caller
}: Caller & { taskKey: string; subtasks: SubtaskPlan[] }) {
  const parent = await findTaskByKey(caller.workspaceId, taskKey);
  const directory = await loadDirectory(caller.workspaceId);
  const resolved = await resolveSubtasks(
    caller.workspaceId,
    directory,
    subtasks,
  );
  return {
    key: `${parent.slug}-${parent.number ?? "?"}`,
    title: parent.title,
    subtasks: await createSubtasks(caller, parent.id, resolved),
  };
}

/**
 * Changes a task or subtask found by its key: its status, its owner, and what
 * it waits on. Everything is resolved before the first change is made.
 */
export async function updateByKey({
  key,
  status,
  owner,
  waitsOn = [],
  ...caller
}: Caller & {
  key: string;
  status?: string;
  /** A person, or null to remove the owner. */
  owner?: string | null;
  waitsOn?: string[];
}) {
  const task = await findTaskByKey(caller.workspaceId, key);
  await assertProjectAccess(caller.currentUserId, task.projectId);
  const actor = caller.actor ?? personActor(caller.currentUserId);
  const directory = await loadDirectory(caller.workspaceId);
  const newOwner = owner
    ? unwrap(matchMember(directory.members, owner))
    : undefined;
  // Refuse an outsider's owner change before anything is written; the
  // assignee controller checks again under the task lock.
  if (owner !== undefined && actor.kind === "person") {
    const [row] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task.id))
      .limit(1);
    if (row && (newOwner?.id ?? null) !== row.userId) {
      const consent = decideConsent(
        "assign",
        await loadConsentFacts(db, row, actor),
      );
      if (consent.kind === "deny") throw consentError(consent);
    }
  }
  const blockers = [];
  for (const ref of waitsOn) {
    blockers.push(await findTaskByKey(caller.workspaceId, ref));
  }

  for (const blocker of blockers) {
    await createTaskRelation({
      sourceTaskId: blocker.id,
      targetTaskId: task.id,
      relationType: "blocks",
      userId: caller.currentUserId,
      workspaceId: caller.workspaceId,
    });
  }
  if (owner !== undefined) {
    await updateTaskAssignee({
      id: task.id,
      userId: newOwner?.id ?? null,
      currentUserId: caller.currentUserId,
      actor,
    });
  }
  // Status last: a new "waits on" link can make "done" invalid, and the
  // caller should hear that instead of finishing a task that is now blocked.
  const result = status
    ? await updateTaskStatus({
        id: task.id,
        status: statusSlug(status),
        currentUserId: caller.currentUserId,
        actor,
      })
    : null;

  const item = {
    id: task.id,
    key: `${task.slug}-${task.number ?? "?"}`,
    title: task.title,
    status: result?.task.status ?? task.status,
    owner: owner === undefined ? undefined : (newOwner?.name ?? null),
    nowWaitsOn: blockers.map((b) => `${b.slug}-${b.number ?? "?"}`),
  };
  return result?.outcome === "requested"
    ? {
        outcome: "requested" as const,
        request: result.request satisfies ChangeRequestRow,
        ...item,
      }
    : { outcome: "applied" as const, ...item };
}
