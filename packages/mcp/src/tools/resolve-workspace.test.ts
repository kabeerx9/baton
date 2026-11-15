import { describe, expect, it } from "vite-plus/test";
import { resolveWorkspaceId } from "./resolve-workspace.js";

const client = (workspaces: unknown[]) => ({
  json: async <T>() => workspaces as T,
});
const two = [
  { id: "w1", name: "Acme", slug: "acme" },
  { id: "w2", name: "Side Project", slug: "side" },
];

describe("resolveWorkspaceId", () => {
  it("prefers the named workspace by id, name or slug", async () => {
    await expect(resolveWorkspaceId(client(two), "w2", "w1")).resolves.toBe(
      "w2",
    );
    await expect(
      resolveWorkspaceId(client(two), "side project", "w1"),
    ).resolves.toBe("w2");
    await expect(resolveWorkspaceId(client(two), "SIDE", null)).resolves.toBe(
      "w2",
    );
  });

  it("falls back to the default, then the only workspace", async () => {
    await expect(
      resolveWorkspaceId(client(two), undefined, "w2"),
    ).resolves.toBe("w2");
    await expect(
      resolveWorkspaceId(client([two[0]]), undefined, null),
    ).resolves.toBe("w1");
  });

  it("lists valid names when it cannot choose", async () => {
    await expect(
      resolveWorkspaceId(client(two), undefined, null),
    ).rejects.toThrow('"Acme", "Side Project"');
    await expect(
      resolveWorkspaceId(client(two), undefined, "gone"),
    ).rejects.toThrow('"Acme", "Side Project"');
    await expect(resolveWorkspaceId(client(two), "Nope", "w1")).rejects.toThrow(
      'No workspace "Nope"',
    );
  });
});
