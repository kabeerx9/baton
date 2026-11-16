// Makes two `pg_dump --schema-only` outputs comparable: drops comments,
// psql meta lines and SET statements, sorts the columns inside each
// CREATE TABLE, collapses whitespace and sorts the statements. Column order
// differs between a squashed baseline and a replayed chain; nothing else is
// ignored, so defaults, constraints, index predicates, functions and
// triggers still differ when they differ.
export function normalizeSchemaDump(dump: string): string {
  const lines = dump
    .split("\n")
    .filter((line) => !line.startsWith("--") && !line.startsWith("\\"));

  const statements: string[] = [];
  let buffer: string[] = [];
  let inDollarQuote = false;
  for (const line of lines) {
    if ((line.match(/\$\$/g)?.length ?? 0) % 2 === 1)
      inDollarQuote = !inDollarQuote;
    buffer.push(line);
    if (!inDollarQuote && line.trimEnd().endsWith(";")) {
      statements.push(buffer.join("\n").trim());
      buffer = [];
    }
  }

  return statements
    .filter(
      (statement) =>
        statement &&
        !statement.startsWith("SET ") &&
        !statement.startsWith("SELECT pg_catalog.set_config"),
    )
    .map((statement) => {
      const table = statement.match(/^(CREATE TABLE [^(]+\()\n([\s\S]*)\n\);$/);
      const sorted = table
        ? `${table[1]}${table[2]!
            .split("\n")
            .map((column) => column.trim().replace(/,$/, ""))
            .sort()
            .join(", ")});`
        : statement;
      return sorted.replace(/\s+/g, " ");
    })
    .sort()
    .join("\n");
}
