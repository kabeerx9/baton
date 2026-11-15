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
    ).rejects.toThrow(/"Acme".*"Side Project"/);
    await expect(
      resolveWorkspaceId(client(two), undefined, "gone"),
    ).rejects.toThrow(/"Acme".*"Side Project"/);
    await expect(resolveWorkspaceId(client(two), "Nope", "w1")).rejects.toThrow(
      'No workspace "Nope"',
    );
  });

  it("refuses an ambiguous name and lists ids and slugs", async () => {
    const twins = [
      { id: "a", name: "Acme", slug: "acme-one" },
      { id: "b", name: "Acme", slug: "acme-two" },
    ];
    for (const order of [twins, [...twins].reverse()]) {
      const result = resolveWorkspaceId(client(order), "Acme", "b");
      await expect(result).rejects.toThrow("matches 2 workspaces");
      await expect(result).rejects.toThrow("acme-one");
      await expect(result).rejects.toThrow("acme-two");
    }
    // The id and the slug still pick one.
    await expect(resolveWorkspaceId(client(twins), "b", "a")).resolves.toBe(
      "b",
    );
    await expect(
      resolveWorkspaceId(client(twins), "acme-two", "a"),
    ).resolves.toBe("b");
  });

  it("prefers an exact-case name and refuses a case-only collision", async () => {
    const cased = [
      { id: "a", name: "Acme", slug: "a1" },
      { id: "b", name: "ACME", slug: "b1" },
    ];
    await expect(resolveWorkspaceId(client(cased), "ACME", "a")).resolves.toBe(
      "b",
    );
    await expect(resolveWorkspaceId(client(cased), "Acme", "b")).resolves.toBe(
      "a",
    );
    await expect(
      resolveWorkspaceId(client(cased), "acme", "a"),
    ).rejects.toThrow("matches 2 workspaces");
  });

  it("prefers a slug over another workspace's name", async () => {
    const clash = [
      { id: "a", name: "ops", slug: "operations" },
      { id: "b", name: "Platform", slug: "ops" },
    ];
    for (const order of [clash, [...clash].reverse()]) {
      await expect(resolveWorkspaceId(client(order), "ops", "a")).resolves.toBe(
        "b",
      );
    }
  });
});
