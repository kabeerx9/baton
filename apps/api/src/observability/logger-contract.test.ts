import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, it } from "vite-plus/test";

// The logger contract (logger.ts): the message is a fixed literal and
// details go in attributes. A message built from an error, or one built
// at all while an error is passed, can copy database values verbatim
// past every structural redaction. TypeScript 7 has no compiler API, so
// this reads the call's top-level arguments with a small scanner.

const SRC = resolve(__dirname, "..");
const CALL = /\blogger\.(?:debug|info|warn|error)\(/g;
const QUOTES = new Set(['"', "'", "`"]);

/** The top-level argument texts of the call whose "(" is at `open`. */
function callArguments(src: string, open: number): string[] {
  const args: string[] = [];
  const closers: string[] = [")"];
  let start = open + 1;
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i]!;
    const top = closers.at(-1);
    if (top === "`") {
      if (ch === "\\") i++;
      else if (ch === "`") closers.pop();
      else if (ch === "$" && src[i + 1] === "{") {
        closers.push("}");
        i++;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (ch === "`") closers.push("`");
    else if (ch === "(") closers.push(")");
    else if (ch === "[") closers.push("]");
    else if (ch === "{") closers.push("}");
    else if (ch === top) {
      closers.pop();
      if (closers.length === 0) {
        args.push(src.slice(start, i));
        return args.map((a) => a.trim()).filter(Boolean);
      }
    } else if (ch === "," && closers.length === 1) {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return args;
}

/** A single string literal with no interpolation. */
function isPlainLiteral(text: string): boolean {
  const quote = text[0];
  if (!quote || !QUOTES.has(quote) || text.at(-1) !== quote) return false;
  const body = text.slice(1, -1);
  if (quote === "`" && body.includes("${")) return false;
  // One literal, not two joined with +.
  return !new RegExp(`(?<!\\\\)${quote}`).test(body);
}

const ERROR_ATTR = /(?:^|[{,\s])(?:error|err|cause)\s*(?:[:,}]|$)/m;
const ERROR_IN_MESSAGE = /\berr(?:or)?\b/;

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) yield path;
  }
}

it("logs errors with a fixed message and details in attributes", () => {
  const offenders: string[] = [];
  for (const path of sourceFiles(SRC)) {
    const src = readFileSync(path, "utf8");
    for (const match of src.matchAll(CALL)) {
      const open = match.index + match[0].length - 1;
      const [message = "", attributes = ""] = callArguments(src, open);
      if (isPlainLiteral(message)) continue;
      if (ERROR_ATTR.test(attributes) || ERROR_IN_MESSAGE.test(message)) {
        const line = src.slice(0, match.index).split("\n").length;
        offenders.push(`${relative(SRC, path)}:${line} ${message}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

it("reads a call's arguments the way the contract needs", () => {
  const args = (src: string) => callArguments(src, src.indexOf("("));
  // Source text that holds a template placeholder, built so the lint rule
  // against placeholders in plain strings does not fire.
  const open = "$" + "{";
  expect(args(`logger.error(\`a ${open}b(c)}\`, { error })`)).toEqual([
    `\`a ${open}b(c)}\``,
    "{ error }",
  ]);
  expect(isPlainLiteral('"Fixed message"')).toBe(true);
  expect(isPlainLiteral('"failed: " + error.message')).toBe(false);
  expect(isPlainLiteral(`\`Failed ${open}id}\``)).toBe(false);
  expect(ERROR_ATTR.test("{ id, error }")).toBe(true);
  expect(ERROR_ATTR.test("{ error_code: x }")).toBe(false);
});
