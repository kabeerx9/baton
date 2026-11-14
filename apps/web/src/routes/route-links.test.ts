import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    const isSource = /\.tsx?$/.test(entry.name);
    const isTest = /\.test\./.test(entry.name);
    return isSource && !isTest && entry.name !== "routeTree.gen.ts"
      ? [full]
      : [];
  });
}

/** Every route path the generated tree can match, e.g. "/auth/sign-in". */
function knownRoutes(): Set<string> {
  const tree = readFileSync(join(SRC, "routeTree.gen.ts"), "utf8");
  const block = tree.match(/interface FileRoutesByTo \{([\s\S]*?)\n\}/)?.[1];
  if (!block) throw new Error("FileRoutesByTo not found in routeTree.gen.ts");
  return new Set(
    [...block.matchAll(/'([^']+)':/g)].map((match) => match[1] as string),
  );
}

/** Static route paths passed as `to` to Link, navigate, redirect or preload. */
function linkedRoutes(source: string): string[] {
  const patterns = [
    /\bto=\{?\s*["'`](\/[^"'`$]*(?:\$[\w]+[^"'`]*)?)["'`]/g,
    /\bto:\s*["'](\/[^"']*)["']/g,
  ];
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1] as string),
  );
}

const normalize = (path: string) => path.replace("/{-$title}", "");

describe("route links", () => {
  it("only point at routes that exist in the route tree", () => {
    const known = new Set([...knownRoutes()].map(normalize));
    const dead: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const path of linkedRoutes(readFileSync(file, "utf8"))) {
        if (!known.has(normalize(path)))
          dead.push(`${file.slice(SRC.length + 1)}: ${path}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it("sees the route tree and finds links to check", () => {
    expect(knownRoutes().has("/auth/sign-in")).toBe(true);
    const found = sourceFiles(SRC).flatMap((file) =>
      linkedRoutes(readFileSync(file, "utf8")),
    );
    expect(found.length).toBeGreaterThan(20);
  });

  it("flags a path that is not in the tree", () => {
    expect(
      linkedRoutes('navigate({ to: "/dashboard/workspace/$id/gone" })'),
    ).toEqual(["/dashboard/workspace/$id/gone"]);
    expect(knownRoutes().has("/dashboard/workspace/$id/gone")).toBe(false);
  });
});
