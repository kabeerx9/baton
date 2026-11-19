import { describe, expect, it } from "vite-plus/test";
import { workspaceCapabilities } from "./capabilities";
import { BUILT_IN_ROLE_STATEMENTS, permits, statement } from "./index";

describe("workspaceCapabilities", () => {
  it("only names resources and actions from the permission statement", () => {
    const known = statement as Record<string, readonly string[]>;
    for (const [name, permissions] of Object.entries(workspaceCapabilities)) {
      for (const [resource, actions] of Object.entries(permissions)) {
        expect(known[resource], `${name} → ${resource}`).toBeDefined();
        for (const action of actions) {
          expect(known[resource], `${name} → ${resource}:${action}`).toContain(
            action,
          );
        }
      }
    }
  });
});

describe("updateAssignedTasks", () => {
  const { updateAssignedTasks, updateTasks } = workspaceCapabilities;
  const holds = (
    role: keyof typeof BUILT_IN_ROLE_STATEMENTS,
    cap: Record<string, readonly string[]>,
  ) => permits(BUILT_IN_ROLE_STATEMENTS[role], cap);

  it("is true for the viewer, who lacks updateTasks", () => {
    expect(holds("viewer", updateAssignedTasks)).toBe(true);
    expect(holds("viewer", updateTasks)).toBe(false);
  });

  it("is true for every role that holds updateTasks", () => {
    for (const role of ["member", "admin", "owner"] as const) {
      expect(holds(role, updateTasks)).toBe(true);
      expect(holds(role, updateAssignedTasks)).toBe(true);
    }
  });
});
