// Makes two `pg_dump --schema-only` outputs comparable: drops comments,
// psql meta lines and SET statements, sorts the columns inside each
// CREATE TABLE, collapses whitespace and sorts the statements. Column order
// differs between a squashed baseline and a replayed chain; nothing else is
// ignored. Whitespace is rewritten only outside quotes: string literals,
// quoted identifiers and dollar-quoted function bodies stay byte-for-byte.

type Piece = { text: string; quoted: boolean };

const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;

function closingQuote(text: string, start: number, quote: string) {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === quote) {
      if (text[index + 1] !== quote) return index + 1;
      index += 2;
    } else index += 1;
  }
  return text.length;
}

// Splits SQL into code and quoted pieces, dropping `--` comments and psql
// meta lines (a backslash at the start of a line) found in code.
function scan(sql: string): Piece[] {
  const pieces: Piece[] = [];
  let code = "";
  let index = 0;
  const pushQuoted = (end: number) => {
    pieces.push({ text: code, quoted: false });
    pieces.push({ text: sql.slice(index, end), quoted: true });
    code = "";
    index = end;
  };

  while (index < sql.length) {
    const char = sql[index]!;
    const atLineStart = index === 0 || sql[index - 1] === "\n";
    if (
      (char === "-" && sql[index + 1] === "-") ||
      (char === "\\" && atLineStart)
    ) {
      const end = sql.indexOf("\n", index);
      index = end === -1 ? sql.length : end;
    } else if (char === "'" || char === '"') {
      pushQuoted(closingQuote(sql, index, char));
    } else if (char === "$" && DOLLAR_TAG.test(sql.slice(index))) {
      const tag = sql.slice(index).match(DOLLAR_TAG)![0];
      const close = sql.indexOf(tag, index + tag.length);
      pushQuoted(close === -1 ? sql.length : close + tag.length);
    } else {
      code += char;
      index += 1;
    }
  }
  pieces.push({ text: code, quoted: false });
  return pieces.filter((piece) => piece.text !== "");
}

// Splits on a separator that occurs in code, never inside quotes.
function splitCode(pieces: Piece[], separator: RegExp): Piece[][] {
  const parts: Piece[][] = [[]];
  for (const piece of pieces) {
    if (piece.quoted) {
      parts.at(-1)!.push(piece);
      continue;
    }
    const chunks = piece.text.split(separator);
    chunks.forEach((chunk, position) => {
      if (position > 0) parts.push([]);
      if (chunk) parts.at(-1)!.push({ text: chunk, quoted: false });
    });
  }
  return parts;
}

function render(pieces: Piece[]) {
  return pieces
    .map((piece) =>
      piece.quoted ? piece.text : piece.text.replace(/\s+/g, " "),
    )
    .join("")
    .trim();
}

function normalizeStatement(pieces: Piece[]): string {
  const statement = render(pieces);
  const table = statement.match(/^CREATE TABLE [^(]+\(/);
  if (!table || !statement.endsWith(")")) return statement;

  // Re-split the column list on the line breaks pg_dump puts between
  // columns, so a comma inside a default expression stays intact.
  const head = pieces.map((piece) => piece.text).join("");
  const open = head.indexOf("(");
  const body = scan(head.slice(open + 1, head.lastIndexOf(")")));
  const columns = splitCode(body, /,\s*\n/)
    .map(render)
    .filter(Boolean)
    .sort();
  return `${render(scan(head.slice(0, open)))} (${columns.join(", ")})`;
}

export function normalizeSchemaDump(dump: string): string {
  return splitCode(scan(dump), /;[ \t]*(?:\n|$)/)
    .map(normalizeStatement)
    .filter(
      (statement) =>
        statement &&
        !statement.startsWith("SET ") &&
        !statement.startsWith("SELECT pg_catalog.set_config"),
    )
    .sort()
    .join("\n");
}
