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

  it("refuses names that differ only in case", async () => {
    const cased = [
      { id: "a", name: "Acme", slug: "a1" },
      { id: "b", name: "ACME", slug: "b1" },
    ];
    for (const text of ["ACME", "Acme", "acme"]) {
      await expect(
        resolveWorkspaceId(client(cased), text, "a"),
      ).rejects.toThrow("matches 2 workspaces");
    }
    await expect(resolveWorkspaceId(client(cased), "b", "a")).resolves.toBe(
      "b",
    );
  });

  it("refuses text that is one workspace's slug and another's name", async () => {
    const clash = [
      { id: "a", name: "ops", slug: "operations" },
      { id: "b", name: "Platform", slug: "ops" },
    ];
    for (const order of [clash, [...clash].reverse()]) {
      await expect(
        resolveWorkspaceId(client(order), "ops", "a"),
      ).rejects.toThrow("matches 2 workspaces");
    }
  });

  it("refuses a duplicate name that is also one duplicate's slug", async () => {
    // Review case: both are "Acme"; A's slug is "acme", B's is "acme-2".
    const twins = [
      { id: "a", name: "Acme", slug: "acme" },
      { id: "b", name: "Acme", slug: "acme-2" },
    ];
    for (const order of [twins, [...twins].reverse()]) {
      const result = resolveWorkspaceId(client(order), "Acme", "b");
      await expect(result).rejects.toThrow("matches 2 workspaces");
      await expect(result).rejects.toThrow("Nothing was changed");
    }
    // Unique slugs and exact ids still resolve.
    await expect(
      resolveWorkspaceId(client(twins), "acme-2", "a"),
    ).resolves.toBe("b");
    await expect(resolveWorkspaceId(client(twins), "a", "b")).resolves.toBe(
      "a",
    );
  });
});
