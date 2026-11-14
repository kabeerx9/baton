import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BatonClient } from "./client.js";

describe("BatonClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("adds auth and json headers for requests with a body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new BatonClient({
      baseUrl: "https://api.example.com",
      apiKey: "token-123",
    });

    await expect(
      client.json("/api/project", {
        method: "POST",
        body: JSON.stringify({ name: "Inbox" }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("surfaces a 401 without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Unauthorized", code: "UNAUTHORIZED" }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new BatonClient({
      baseUrl: "https://api.example.com",
      apiKey: "token-123",
    });

    await expect(client.json("/api/task/task-1")).rejects.toThrow(
      "/api/task/task-1: Unauthorized (UNAUTHORIZED)",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces api error messages when a request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Task not found", code: "NOT_FOUND" }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        },
      ),
    ) as typeof fetch;

    const client = new BatonClient({
      baseUrl: "https://api.example.com",
      apiKey: "token-123",
    });

    await expect(client.json("/api/task/missing")).rejects.toThrow(
      "/api/task/missing: Task not found (NOT_FOUND)",
    );
  });

  it("names missing permissions through the error code", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Insufficient API key scope",
          code: "API_KEY_SCOPE",
          missingPermissions: ["task:update"],
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const client = new BatonClient({
      baseUrl: "https://api.example.com",
      apiKey: "token-123",
    });

    await expect(client.json("/api/task/task-1")).rejects.toThrow(
      "/api/task/task-1: Insufficient API key scope (API_KEY_SCOPE)",
    );
  });

  it("falls back to a text body from an older API", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("Task not found", { status: 404 }),
      ) as typeof fetch;

    const client = new BatonClient({
      baseUrl: "https://api.example.com",
      apiKey: "token-123",
    });

    await expect(client.json("/api/task/missing")).rejects.toThrow(
      /^\/api\/task\/missing: Task not found$/,
    );
  });
});
