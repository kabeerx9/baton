export type RelationEndpoints = {
  type: string;
  /** Where the event was published; used only when no endpoint project is known. */
  projectId: string;
  sourceTaskId?: string;
  targetTaskId?: string;
  sourceProjectId?: string;
  targetProjectId?: string;
};

type Ids = { sourceTaskId?: string; targetTaskId?: string };

/**
 * One message per project a relation touches. A project's subscribers can
 * read that project, not necessarily the other one, so each message names
 * only the endpoints that live in its project: enough to refresh that board.
 * An endpoint whose project is unknown is named nowhere; with neither known,
 * the publishing project gets a refresh with no ids.
 */
export function relationBroadcasts(event: RelationEndpoints) {
  const byProject = new Map<string, Ids>();
  const add = (projectId: string | undefined, ids: Ids) => {
    if (!projectId) return;
    byProject.set(projectId, { ...byProject.get(projectId), ...ids });
  };
  add(event.sourceProjectId, { sourceTaskId: event.sourceTaskId });
  add(event.targetProjectId, { targetTaskId: event.targetTaskId });
  if (byProject.size === 0) byProject.set(event.projectId, {});
  return [...byProject].map(([projectId, ids]) => ({
    projectId,
    message: {
      type: event.type,
      projectId,
      taskId: ids.sourceTaskId ?? ids.targetTaskId ?? "",
      ...ids,
    },
  }));
}
