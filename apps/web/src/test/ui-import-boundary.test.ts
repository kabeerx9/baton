import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = path.resolve(__dirname, "..");

// Only UI SDK and Base UI wrappers may import the libraries (record D2, D6).
const UI_SDK_ALLOWED = [
  "components/ui/",
  "components/primitives/",
  "components/board/keyboard/",
];

// Feature files that still import Base UI directly. Each is ported by a wrapper
// job, and Z1 empties this list.
// The J0 smoke test imports UI SDK directly on purpose.
const UI_SDK_ALLOWED_FILES = ["test/ui-sdk-smoke.test.tsx"];

const BASE_UI_ALLOWED_FILES = [
  "components/common/option-menu/option-menu.tsx",
  "components/task/task-delete-dialog.tsx",
  "components/task/header/task-header-actions.tsx",
  "components/shortcuts/shortcuts-panel.tsx",
  "components/task/header/task-more-menu.tsx",
  "components/account/theme-picker.tsx",
];
const BASE_UI_ALLOWED_DIRS = ["components/ui/"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

// Matches real import specifiers only, not a package name in a comment.
function importsOf(source: string, prefix: string) {
  const pattern = new RegExp(
    `(?:from\\s+|import\\s*\\(?\\s*|@import\\s+)["']${prefix}`,
  );
  return pattern.test(source);
}

function offenders(prefix: string, allowed: (relative: string) => boolean) {
  return sourceFiles(SRC)
    .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
    .filter((relative) => relative !== "test/ui-import-boundary.test.ts")
    .filter((relative) =>
      importsOf(readFileSync(path.join(SRC, relative), "utf8"), prefix),
    )
    .filter((relative) => !allowed(relative));
}

describe("UI library import boundary", () => {
  it("imports @ui-sdk/ only inside the allowed folders", () => {
    expect(
      offenders(
        "@ui-sdk/",
        (relative) =>
          UI_SDK_ALLOWED.some((dir) => relative.startsWith(dir)) ||
          UI_SDK_ALLOWED_FILES.includes(relative),
      ),
    ).toEqual([]);
  });

  it("imports @base-ui/ only in components/ui and the known direct importers", () => {
    expect(
      offenders(
        "@base-ui/",
        (relative) =>
          BASE_UI_ALLOWED_DIRS.some((dir) => relative.startsWith(dir)) ||
          BASE_UI_ALLOWED_FILES.includes(relative),
      ),
    ).toEqual([]);
  });

  it("detects an import and ignores a mention in a comment", () => {
    expect(
      importsOf('import { X } from "@ui-sdk/react/dialog";', "@ui-sdk/"),
    ).toBe(true);
    expect(
      importsOf('const x = await import("@ui-sdk/core");', "@ui-sdk/"),
    ).toBe(true);
    expect(importsOf("// uses @ui-sdk/react", "@ui-sdk/")).toBe(false);
  });
});
