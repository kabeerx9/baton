import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { statement } from "../../packages/permissions/src/statements";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OLD = ["organization", "invitation", "ac"];

// A resource name used as a permission: an object key holding an action list,
// or a `resource:action` string.
const asKey = new RegExp(
  `(?<![\\w.-])["']?(${OLD.join("|")})["']?\\s*:\\s*\\[`,
);
const asAction = new RegExp(`["'\`](${OLD.join("|")}):[a-z_]+`);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === "node_modules" || name === "dist") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("permission vocabulary", () => {
  it("has no provider-era resources", () => {
    for (const name of OLD) expect(Object.keys(statement)).not.toContain(name);
  });

  it("names no provider-era resource as a permission in the source", () => {
    const hits = ["packages/permissions/src", "apps/api/src", "apps/web/src"]
      .flatMap((folder) => sourceFiles(join(root, folder)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            asKey.test(line) || asAction.test(line)
              ? [`${relative(root, file)}:${index + 1}: ${line.trim()}`]
              : [],
          ),
      );
    expect(hits).toEqual([]);
  });
});
