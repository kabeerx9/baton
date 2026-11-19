import { describe, expect, it } from "vite-plus/test";
import { buildFullTaskUpdateBody } from "./task-helpers.js";

describe("buildFullTaskUpdateBody", () => {
  it("merges patch onto existing task", () => {
    // Arrange
    const original = {
      title: "T",
      description: "D",
      status: "open",
      priority: "low",
      projectId: "p1",
      position: 1,
      userId: "u1",
    };
    const patch = { status: "done" as const };

    // Act
    const body = buildFullTaskUpdateBody(original, patch);

    // Assert
    expect(body.status).toBe("done");
    expect(body.title).toBe("T");
    expect(body.position).toBe(1);
  });

  const assigned = {
    title: "T",
    status: "open",
    priority: "low",
    projectId: "p1",
    position: 1,
    userId: "u1",
  };

  it("leaves userId out unless the patch sets it, so the owner is kept", () => {
    expect(
      buildFullTaskUpdateBody(assigned, { title: "New" }),
    ).not.toHaveProperty("userId");
  });

  it("sends the new owner, or an empty string to unassign", () => {
    expect(buildFullTaskUpdateBody(assigned, { userId: "u2" }).userId).toBe(
      "u2",
    );
    expect(buildFullTaskUpdateBody(assigned, { userId: null }).userId).toBe("");
  });
});
