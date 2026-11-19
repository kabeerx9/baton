import { describe, expect, it } from "vite-plus/test";
import { relationBroadcasts } from "./relation-broadcasts";

const type = "TASK_RELATION_UPDATED";
const base = { type, projectId: "A", sourceTaskId: "a", targetTaskId: "b" };

describe("relationBroadcasts", () => {
  it("sends one message with both ids when both tasks share a project", () => {
    expect(
      relationBroadcasts({
        ...base,
        sourceProjectId: "A",
        targetProjectId: "A",
      }),
    ).toEqual([
      {
        projectId: "A",
        message: {
          type,
          projectId: "A",
          taskId: "a",
          sourceTaskId: "a",
          targetTaskId: "b",
        },
      },
    ]);
  });

  it("names only each project's own task across projects", () => {
    const sent = relationBroadcasts({
      ...base,
      sourceProjectId: "A",
      targetProjectId: "B",
    });
    expect(sent).toEqual([
      {
        projectId: "A",
        message: { type, projectId: "A", taskId: "a", sourceTaskId: "a" },
      },
      {
        projectId: "B",
        message: { type, projectId: "B", taskId: "b", targetTaskId: "b" },
      },
    ]);
  });

  it("names an endpoint nowhere when its project is unknown", () => {
    expect(relationBroadcasts({ ...base, targetProjectId: "B" })).toEqual([
      {
        projectId: "B",
        message: { type, projectId: "B", taskId: "b", targetTaskId: "b" },
      },
    ]);
    expect(relationBroadcasts(base)).toEqual([
      { projectId: "A", message: { type, projectId: "A", taskId: "" } },
    ]);
  });
});
