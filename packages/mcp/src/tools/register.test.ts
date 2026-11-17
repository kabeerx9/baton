import { describe, expect, it, vi } from "vite-plus/test";
import { CORE_TOOLS, registerTools } from "./register.js";

type RegisteredTool = {
  name: string;
  config: { inputSchema?: { parse: (args: unknown) => unknown } };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
};

function createServerMock() {
  const tools = new Map<string, RegisteredTool>();

  return {
    server: {
      registerTool: vi.fn(
        (
          name: string,
          config: RegisteredTool["config"],
          handler: RegisteredTool["handler"],
        ) => {
          tools.set(name, { name, config, handler });
        },
      ),
    },
    tools,
  };
}

describe("registerTools", () => {
  it("registers the MCP tools", () => {
    const { server } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    expect(server.registerTool).toHaveBeenCalled();
    expect(server.registerTool).toHaveBeenCalledWith(
      "whoami",
      expect.any(Object),
      expect.any(Function),
    );
    expect(server.registerTool).toHaveBeenCalledWith(
      "update_task",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("uses the API-key current-user endpoint for whoami", async () => {
    const { server, tools } = createServerMock();
    const client = {
      usingApiKey: true,
      json: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Mohiuddin",
        email: "user@example.com",
        role: "user",
        token: "unexpected-user-secret",
      }),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("whoami")?.handler({});

    expect(client.json).toHaveBeenCalledWith("/api/user/me", {
      method: "GET",
    });
    expect(result?.isError).toBe(false);
    expect(result?.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          {
            id: "user-1",
            name: "Mohiuddin",
            email: "user@example.com",
            role: "user",
          },
          null,
          2,
        ),
      },
    ]);
  });

  it("uses /api/user/me for whoami without an API key, never the auth API", async () => {
    const { server, tools } = createServerMock();
    const client = {
      usingApiKey: false,
      json: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Mohiuddin",
        email: "user@example.com",
        role: null,
        token: "unexpected-user-secret",
      }),
    };
    registerTools(server as never, { client: client as never, catalog: "all" });

    const result = await tools.get("whoami")?.handler({});

    expect(client.json).toHaveBeenCalledWith("/api/user/me", { method: "GET" });
    expect(result?.content[0]?.text).not.toContain("secret");
  });

  it("builds the expected query string for list_tasks", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue([{ id: "task-1" }]),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("list_tasks")?.handler({
      projectId: "project 1",
      status: "open",
      page: 2,
      relatedPage: 3,
      sortOrder: "desc",
    });

    expect(client.json).toHaveBeenCalledWith(
      "/api/task/tasks/project%201?status=open&page=2&relatedPage=3&sortOrder=desc",
      { method: "GET" },
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ id: "task-1" }], null, 2),
        },
      ],
      isError: false,
    });
  });

  it("reads one task by key with its comments, using the workspace name or default", async () => {
    const { server, tools } = createServerMock();
    const workspaces = [
      { id: "w1", name: "Acme" },
      { id: "w2", name: "Side" },
    ];
    const client = {
      json: vi.fn(async (path: string) => {
        if (path === "/api/workspace") return workspaces;
        if (path.startsWith("/api/comment/")) return [{ id: "c1" }];
        return { id: "task-1", number: 12 };
      }),
    };
    registerTools(server as never, {
      client: client as never,
      catalog: "all",
      defaultWorkspaceId: "w2",
    });
    const tool = tools.get("get_task_by_ticket_id");

    const result = await tool?.handler({ ticketId: "KAN-12" });
    await tool?.handler({ ticketId: "KAN-12", workspaceId: "acme" });
    await tool?.handler({
      ticketId: "KAN-12",
      workspaceId: "w1",
      projectId: "p 1",
    });

    const paths = client.json.mock.calls.map(([path]) => path);
    expect(paths).toEqual([
      "/api/workspace",
      "/api/task/by-ticket-id/KAN-12?workspaceId=w2",
      "/api/comment/task-1",
      "/api/workspace",
      "/api/task/by-ticket-id/KAN-12?workspaceId=w1",
      "/api/comment/task-1",
      "/api/workspace",
      "/api/task/by-ticket-id/KAN-12?workspaceId=w1&projectId=p+1",
      "/api/comment/task-1",
    ]);
    expect(JSON.parse(result?.content[0]?.text ?? "")).toEqual({
      id: "task-1",
      number: 12,
      comments: [{ id: "c1" }],
    });
  });

  it("asks the API to resolve a key when there is no workspace to use", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn(async (path: string) =>
        path.startsWith("/api/comment/") ? [] : { id: "task-1" },
      ),
    };
    registerTools(server as never, { client: client as never, catalog: "all" });
    await tools.get("get_task_by_ticket_id")?.handler({ ticketId: "T-1" });
    expect(client.json).toHaveBeenNthCalledWith(
      1,
      "/api/task/by-ticket-id/T-1",
      {
        method: "GET",
      },
    );
  });

  it("lists only the core tools by default and every tool with catalog all", () => {
    const core = createServerMock();
    registerTools(core.server as never, { client: { json: vi.fn() } as never });
    expect([...core.tools.keys()].sort()).toEqual([...CORE_TOOLS].sort());
    expect(core.tools.size).toBe(12);

    const all = createServerMock();
    registerTools(all.server as never, {
      client: { json: vi.fn() } as never,
      catalog: "all",
    });
    // The full catalog: 43 tools.
    expect(all.tools.size).toBe(43);
  });

  it("does not list create_task, which made repo tasks no screen shows", () => {
    for (const catalog of ["core", "all"] as const) {
      const { server, tools } = createServerMock();
      registerTools(server as never, {
        client: { json: vi.fn() } as never,
        catalog,
      });
      expect(tools.has("create_task")).toBe(false);
      expect(tools.has("create_board_task")).toBe(true);
      expect(tools.has("add_subtasks")).toBe(true);
    }
  });

  it("describes the board's done window on get_board", () => {
    const { server } = createServerMock();
    registerTools(server as never, { client: { json: vi.fn() } as never });
    const [, config] =
      server.registerTool.mock.calls.find(([name]) => name === "get_board") ??
      [];
    const description = (config as { description: string }).description;
    expect(description).toContain("14 days");
    expect(description).toContain("olderDoneCount");
    expect(description).toContain("get_team_history");
    expect(description).toContain("get_task_by_ticket_id");
    expect(description).toContain("statusChange");
  });

  it("adds a feature's visible tasks from the one-item read", async () => {
    const { server, tools } = createServerMock();
    const subtasks = [{ id: "s1", key: "API-3" }];
    const tasks: Record<string, object> = {
      "T-1": { id: "f1", workspaceId: "w1", isSubtask: false },
      "API-3": { id: "s1", workspaceId: "w1", isSubtask: true },
      "T-2": { id: "p1", workspaceId: "w1", isSubtask: false },
    };
    const client = {
      json: vi.fn(async (path: string) => {
        if (path.startsWith("/api/comment/")) return [];
        if (path === "/api/board/workspace/w1/item/f1")
          return { task: { id: "f1", subtasks } };
        if (path === "/api/board/workspace/w1/item/p1")
          return { task: { id: "p1", subtasks: [] } };
        const key = decodeURIComponent(path.split("/").pop() ?? "");
        return tasks[key];
      }),
    };
    registerTools(server as never, { client: client as never });
    const read = async (ticketId: string) =>
      JSON.parse(
        (await tools.get("get_task_by_ticket_id")?.handler({ ticketId }))
          ?.content[0]?.text ?? "",
      );

    expect((await read("T-1")).subtasks).toEqual(subtasks);
    // A subtask key never reads its parent, so it gets no siblings.
    expect(await read("API-3")).not.toHaveProperty("subtasks");
    expect(await read("T-2")).not.toHaveProperty("subtasks");
    const paths = client.json.mock.calls.map(([path]) => path);
    expect(paths).not.toContain("/api/board/workspace/w1/item/s1");
  });

  it("still returns the task when the one-item read is refused", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn(async (path: string) => {
        if (path.startsWith("/api/comment/")) return [];
        if (path.startsWith("/api/board/")) throw new Error("Forbidden");
        return { id: "f1", workspaceId: "w9", isSubtask: false };
      }),
    };
    registerTools(server as never, { client: client as never });
    const result = await tools
      .get("get_task_by_ticket_id")
      ?.handler({ ticketId: "T-1" });
    expect(result?.isError).toBe(false);
    expect(JSON.parse(result?.content[0]?.text ?? "")).toEqual({
      id: "f1",
      workspaceId: "w9",
      isSubtask: false,
      comments: [],
    });
  });

  it("uses the default workspace for board tools and lists names when none fits", async () => {
    const { server, tools } = createServerMock();
    const workspaces = [
      { id: "w1", name: "Acme" },
      { id: "w2", name: "Side" },
    ];
    const client = {
      json: vi.fn(async (path: string) =>
        path === "/api/workspace" ? workspaces : [],
      ),
    };
    registerTools(server as never, {
      client: client as never,
      defaultWorkspaceId: "w1",
    });
    await tools.get("list_my_tasks")?.handler({});
    expect(client.json).toHaveBeenLastCalledWith(
      "/api/task/assigned?workspaceId=w1",
      { method: "GET" },
    );
    await tools.get("create_board_task")?.handler({
      workspaceId: "Side",
      title: "Ship it",
      owner: "Priya",
    });
    expect(client.json).toHaveBeenLastCalledWith(
      "/api/board/workspace/w2/plan",
      {
        method: "POST",
        body: JSON.stringify({ title: "Ship it", owner: "Priya" }),
      },
    );

    const bare = createServerMock();
    registerTools(bare.server as never, { client: client as never });
    const result = await bare.tools.get("update_board_item")?.handler({
      key: "T-1",
      status: "done",
    });
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toMatch(/Pass workspaceId.*Acme.*Side/);
  });

  it("lists workspaces without the auth API", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue([]) };
    registerTools(server as never, { client: client as never });
    await tools.get("list_workspaces")?.handler({});
    expect(client.json).toHaveBeenCalledWith("/api/workspace", {
      method: "GET",
    });
  });

  it("fetches the current task and sends a full body for update_task", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          title: "Draft spec",
          description: "Write docs",
          status: "open",
          priority: "medium",
          projectId: "project-1",
          position: 4,
        })
        .mockResolvedValueOnce({ id: "task-1", status: "done" }),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("update_task")?.handler({
      taskId: "task-1",
      status: "done",
    });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/task/task-1", {
      method: "GET",
    });
    const putCall = client.json.mock.calls[1];
    expect(putCall?.[0]).toBe("/api/task/task-1");
    const putBody = JSON.parse(
      String((putCall?.[1] as { body?: string })?.body ?? "{}"),
    );
    expect(putBody).toEqual(
      expect.objectContaining({
        title: "Draft spec",
        description: "Write docs",
        status: "done",
        priority: "medium",
        projectId: "project-1",
        position: 4,
      }),
    );
    expect(result?.isError).toBe(false);
  });

  it("fetches the current project and sends a full body for update_project", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          name: "Roadmap",
          slug: "roadmap",
        })
        .mockResolvedValueOnce({ id: "project-1", name: "Roadmap v2" }),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("update_project")?.handler({
      id: "project-1",
      name: "Roadmap v2",
    });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/project/project-1", {
      method: "GET",
    });
    const putCall = client.json.mock.calls[1];
    expect(putCall?.[0]).toBe("/api/project/project-1");
    const putBody = JSON.parse(
      String((putCall?.[1] as { body?: string })?.body ?? "{}"),
    );
    expect(putBody).toEqual({
      name: "Roadmap v2",
      icon: "Layout",
      slug: "roadmap",
      description: "",
    });
    expect(result?.isError).toBe(false);
  });

  it("returns an MCP error result when the client request fails", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockRejectedValue(new Error("boom")),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("whoami")?.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "boom" }, null, 2),
        },
      ],
      isError: true,
    });
  });

  it("validates label colors as hex values", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const schema = tools.get("create_label")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        name: "Bug",
        color: "red",
        workspaceId: "workspace-1",
      }),
    ).toThrow(/hex color/i);
  });

  it("validates task date filters as ISO datetimes with timezone", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const schema = tools.get("list_tasks")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        projectId: "project-1",
        dueBefore: "2026-04-04",
      }),
    ).toThrow();
  });

  it("creates a task relation with the expected body", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue({ id: "rel-1", relationType: "blocks" }),
    };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const result = await tools.get("create_task_relation")?.handler({
      sourceTaskId: "task-1",
      targetTaskId: "task-2",
      relationType: "blocks",
    });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation", {
      method: "POST",
      body: JSON.stringify({
        sourceTaskId: "task-1",
        targetTaskId: "task-2",
        relationType: "blocks",
      }),
    });
    expect(result?.isError).toBe(false);
  });

  it("validates relationType for create_task_relation", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    const schema = tools.get("create_task_relation")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        sourceTaskId: "task-1",
        targetTaskId: "task-2",
        relationType: "duplicate",
      }),
    ).toThrow();
  });

  it("gets task relations by task id", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue([]) };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    await tools.get("get_task_relations")?.handler({ taskId: "task 1" });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation/task%201", {
      method: "GET",
    });
  });

  it("deletes a task relation by id", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue({}) };

    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });

    await tools.get("delete_task_relation")?.handler({ id: "rel-1" });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation/rel-1", {
      method: "DELETE",
    });
  });

  it("deletes a task-associated label without an obsolete preflight", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue({ id: "label-1" }) };
    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });
    const result = await tools.get("delete_label")?.handler({ id: "label-1" });
    expect(client.json).toHaveBeenCalledExactlyOnceWith("/api/label/label-1", {
      method: "DELETE",
      signal: expect.any(AbortSignal),
    });
    expect(result?.isError).toBe(false);
  });

  it("resumes workspace label deletion until the API completes it", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          id: "label-1",
          taskId: null,
          pendingDeletion: true,
        })
        .mockResolvedValueOnce({ id: "label-1", taskId: null }),
    };
    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });
    const result = await tools.get("delete_label")?.handler({ id: "label-1" });
    expect(result?.isError).toBe(false);
    expect(client.json).toHaveBeenCalledTimes(2);
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/label/label-1", {
      method: "DELETE",
      signal: expect.any(AbortSignal),
    });
  });

  it("returns saved progress when the overall deletion deadline expires", async () => {
    const { server, tools } = createServerMock();
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    const progress = { id: "large", pendingDeletion: true };
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce(progress)
        .mockImplementationOnce(async () => {
          controller.abort();
          throw new DOMException("Timed out", "TimeoutError");
        }),
    };
    try {
      registerTools(server as never, {
        client: client as never,
        catalog: "all",
      });
      const result = await tools.get("delete_label")?.handler({ id: "large" });
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(result?.isError).toBe(false);
      expect(client.json).toHaveBeenCalledTimes(2);
      expect(client.json).toHaveBeenLastCalledWith("/api/label/large", {
        method: "DELETE",
        signal: controller.signal,
      });
      expect(result?.content).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('"pendingDeletion": true'),
        }),
      ]);
    } finally {
      timeout.mockRestore();
    }
  });

  it("returns resumable progress when a cascade exceeds one tool call", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue({ pendingDeletion: true }),
    };
    registerTools(server as never, {
      client: client as never,
      catalog: "all",
    });
    const result = await tools.get("delete_label")?.handler({ id: "large" });
    expect(result?.isError).toBe(false);
    expect(client.json).toHaveBeenCalledTimes(100);
    expect(result?.content).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('"pendingDeletion": true'),
      }),
    ]);
  });
});
