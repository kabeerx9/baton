import { describe, expect, it } from "vite-plus/test";
import { normalizeSchemaDump } from "../../../apps/api/scripts/adopt-migration-baseline/normalize-schema-dump";

const table = (columns: string[]) =>
  `--\n-- Name: example\n--\n\nCREATE TABLE public.example (\n    ${columns.join(",\n    ")}\n);\n`;

describe("normalizeSchemaDump", () => {
  it("ignores column order, comments, meta lines and SET statements", () => {
    const a = `\\restrict abc\nSET lock_timeout = 0;\n${table(["id text NOT NULL", "name text"])}`;
    const b = `\\restrict xyz\n${table(["name text", "id text NOT NULL"])}`;
    expect(normalizeSchemaDump(a)).toBe(normalizeSchemaDump(b));
  });

  it("keeps whitespace inside string literals", () => {
    expect(
      normalizeSchemaDump(table(["value text DEFAULT 'a  b'::text"])),
    ).not.toBe(normalizeSchemaDump(table(["value text DEFAULT 'a b'::text"])));
  });

  it("keeps whitespace inside quoted identifiers and function bodies", () => {
    expect(normalizeSchemaDump(table(['"a  b" text']))).not.toBe(
      normalizeSchemaDump(table(['"a b" text'])),
    );
    const fn = (body: string) =>
      `CREATE FUNCTION public.f() RETURNS trigger\n    LANGUAGE plpgsql\n    AS $$${body}$$;\n`;
    expect(normalizeSchemaDump(fn("BEGIN\n  RETURN NEW;\nEND;"))).not.toBe(
      normalizeSchemaDump(fn("BEGIN RETURN NEW; END;")),
    );
  });

  it("does not split statements or columns on separators inside quotes", () => {
    const dump = `${table(["value text DEFAULT 'x;\ny,\nz'::text", "id text"])}CREATE INDEX i ON public.example (id);\n`;
    expect(normalizeSchemaDump(dump)).toBe(
      [
        "CREATE INDEX i ON public.example (id)",
        "CREATE TABLE public.example (id text, value text DEFAULT 'x;\ny,\nz'::text)",
      ].join("\n"),
    );
  });

  it("collapses formatting whitespace outside quotes", () => {
    expect(
      normalizeSchemaDump("CREATE INDEX i\n    ON public.example (id);"),
    ).toBe("CREATE INDEX i ON public.example (id)");
  });
});
