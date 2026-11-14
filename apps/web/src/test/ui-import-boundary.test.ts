import { parseSync } from "@babel/core";
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

type AstNode = { type?: string; [key: string]: unknown };

function stringValue(node: unknown): string | null {
  const n = node as AstNode | null | undefined;
  if (n?.type === "StringLiteral" && typeof n.value === "string")
    return n.value;
  if (
    n?.type === "TemplateLiteral" &&
    Array.isArray(n.expressions) &&
    n.expressions.length === 0
  ) {
    const quasi = (n.quasis as { value: { cooked?: string } }[])[0];
    return quasi?.value.cooked ?? null;
  }
  return null;
}

// Module specifiers a file really loads. Comments never reach the AST, so a
// commented-out import is ignored and a comment inside import(...) is harmless.
function specifiersOf(source: string, file: string): string[] {
  if (file.endsWith(".css")) {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
    return [...css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
  }
  const ast = parseSync(source, {
    filename: file,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
  });
  const found: string[] = [];
  const add = (value: string | null) => {
    if (value !== null) found.push(value);
  };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const n = node as AstNode;
    switch (n.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "ExportNamedDeclaration":
        add(stringValue(n.source));
        break;
      case "ImportExpression":
        add(stringValue(n.source));
        break;
      case "TSImportType":
        add(stringValue(n.argument) ?? stringValue(n.source));
        break;
      case "TSExternalModuleReference":
        add(stringValue(n.expression));
        break;
      case "CallExpression": {
        // require("x"), vi.mock("x"), vi.importActual("x"), and similar.
        const callee = n.callee as AstNode;
        const object = callee.object as AstNode | undefined;
        if (
          (callee.type === "Identifier" && callee.name === "require") ||
          (callee.type === "MemberExpression" &&
            object?.type === "Identifier" &&
            object.name === "vi")
        ) {
          add(stringValue((n.arguments as unknown[])[0]));
        }
        break;
      }
    }
    for (const key of Object.keys(n)) {
      if (key !== "loc" && key !== "comments") visit(n[key]);
    }
  };
  visit(ast);
  return found;
}

function importsOf(source: string, prefix: string, file = "file.tsx") {
  return specifiersOf(source, file).some((specifier) =>
    specifier.startsWith(prefix),
  );
}

function offenders(prefix: string, allowed: (relative: string) => boolean) {
  return sourceFiles(SRC)
    .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
    .filter((relative) => relative !== "test/ui-import-boundary.test.ts")
    .filter((relative) =>
      importsOf(
        readFileSync(path.join(SRC, relative), "utf8"),
        prefix,
        relative,
      ),
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

  it("flags every kind of import and ignores comments", () => {
    const flagged = [
      'import { X } from "@ui-sdk/react/dialog";',
      "import '@ui-sdk/react/dialog';",
      'import type { T } from "@ui-sdk/core";',
      'export * from "@ui-sdk/x";',
      'export { a } from "@ui-sdk/x";',
      'const x = await import("@ui-sdk/core");',
      "const x = await import(/* chunk */ '@ui-sdk/x');",
      'const x = require("@ui-sdk/core");',
      'vi.mock("@ui-sdk/react/dialog", () => ({}));',
      'type T = typeof import("@ui-sdk/core");',
    ];
    for (const code of flagged) {
      expect(importsOf(code, "@ui-sdk/"), code).toBe(true);
    }

    const ignored = [
      "// import { X } from '@ui-sdk/react';",
      '/* import("@ui-sdk/react") */',
      "// uses @ui-sdk/react",
      'const text = "@ui-sdk/react";',
      'import { X } from "./local";',
    ];
    for (const code of ignored) {
      expect(importsOf(code, "@ui-sdk/"), code).toBe(false);
    }
  });

  it("flags a CSS import and ignores a commented one", () => {
    expect(
      importsOf('@import "@ui-sdk/x/styles.css";', "@ui-sdk/", "a.css"),
    ).toBe(true);
    expect(importsOf('/* @import "@ui-sdk/x"; */', "@ui-sdk/", "a.css")).toBe(
      false,
    );
  });

  it("reports a planted violation", () => {
    const planted = (relative: string, code: string) =>
      importsOf(code, "@base-ui/", relative) &&
      !BASE_UI_ALLOWED_DIRS.some((dir) => relative.startsWith(dir)) &&
      !BASE_UI_ALLOWED_FILES.includes(relative);
    const code = 'const m = import(/* c */ "@base-ui/react/dialog");';
    expect(planted("components/task/new-file.tsx", code)).toBe(true);
    expect(planted("components/ui/dialog.tsx", code)).toBe(false);
  });
});
