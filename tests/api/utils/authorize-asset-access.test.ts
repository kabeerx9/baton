import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: {
    resolveCalls: 0,
    validateCalls: [] as { userId: string; workspaceId: string }[],
    caller: "anonymous" as "anonymous" | "member" | "outsider",
    restrictedProjects: new Set<string>(),
    canRead: true,
  },
}));

vi.mock("../../../apps/api/src/utils/workspace-permission-grants", () => ({
  workspacePermissionGrants: async () => ({ allows: () => state.canRead }),
}));

vi.mock("../../../apps/api/src/project-access/assert-project-access", () => ({
  assertProjectAccess: async (_userId: string, projectId: string) => {
    if (state.restrictedProjects.has(projectId)) {
      throw new HTTPException(403, {
        message: "You don't have access to this project",
      });
    }
  },
}));

vi.mock("../../../apps/api/src/utils/authenticate-api-request", () => ({
  // Mirrors the real helper: every unauthenticated path throws, so it never
  // returns a falsy userId.
  resolveAssetBearerOrCookie: async () => {
    state.resolveCalls += 1;
    if (state.caller === "anonymous") {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    return { userId: `user-${state.caller}` };
  },
}));

vi.mock("../../../apps/api/src/utils/validate-workspace-access", () => ({
  validateWorkspaceAccess: async (
    userId: string,
    workspaceId: string,
    _apiKeyId?: string,
    options: { notFoundMessage?: string } = {},
  ) => {
    state.validateCalls.push({ userId, workspaceId });
    if (userId !== "user-member") {
      throw new HTTPException(404, {
        message: options.notFoundMessage ?? "Workspace not found",
      });
    }
  },
}));

const { authorizeAssetAccess } =
  await import("../../../apps/api/src/utils/authorize-asset-access");

const context = {} as Context;

async function statusOf(promise: Promise<void>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    return error instanceof HTTPException ? error.status : 500;
  }
}

describe("authorizeAssetAccess", () => {
  beforeEach(() => {
    state.resolveCalls = 0;
    state.validateCalls = [];
    state.caller = "anonymous";
    state.restrictedProjects = new Set();
    state.canRead = true;
  });

  it("rejects an anonymous caller for any asset", async () => {
    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        projectId: "project-1",
        surface: "description",
      }),
    );

    expect(status).toBe(401);
    expect(state.resolveCalls).toBe(1);
  });

  it("hides a private asset from an authenticated non-member", async () => {
    state.caller = "outsider";

    const error = await authorizeAssetAccess(context, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      surface: "description",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HTTPException);
    expect((error as HTTPException).status).toBe(404);
    expect((error as HTTPException).message).toBe("Asset not found");
  });

  it("allows a workspace member to read a private asset", async () => {
    state.caller = "member";

    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        projectId: "project-1",
        surface: "description",
      }),
    );

    expect(status).toBe(200);
    expect(state.validateCalls).toEqual([
      { userId: "user-member", workspaceId: "workspace-1" },
    ]);
  });
  it("rejects a member whose current read grant has been removed", async () => {
    state.caller = "member";
    state.canRead = false;
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          projectId: "project-1",
          surface: "comment",
        }),
      ),
    ).toBe(403);
  });
  it.each(["comment", "unknown"])(
    "keeps %s assets private to members",
    async (surface) => {
      const asset = {
        workspaceId: "workspace-1",
        projectId: "project-1",
        surface,
      };
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(401);
      state.caller = "outsider";
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(404);
      state.caller = "member";
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(200);
    },
  );
  it.each(["draft", "draft-pending"])(
    "keeps %s uploads private to the uploader",
    async (surface) => {
      state.caller = "member";
      const asset = {
        workspaceId: "workspace-1",
        projectId: "project-1",
        surface,
        createdBy: "user-other-member",
      };
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(403);
      state.caller = "outsider";
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(404);
      state.caller = "member";
      expect(
        await statusOf(
          authorizeAssetAccess(context, { ...asset, createdBy: "user-member" }),
        ),
      ).toBe(200);
    },
  );
  it.each(["description", "comment", "draft"])(
    "rejects a workspace member restricted from the project for %s assets",
    async (surface) => {
      state.caller = "member";
      state.restrictedProjects.add("project-1");
      const asset = {
        workspaceId: "workspace-1",
        projectId: "project-1",
        surface,
        createdBy: "user-member",
      };
      expect(await statusOf(authorizeAssetAccess(context, asset))).toBe(403);
      expect(
        await statusOf(
          authorizeAssetAccess(context, { ...asset, projectId: "project-2" }),
        ),
      ).toBe(200);
    },
  );
});
