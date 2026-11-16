// libpq lets URL query parameters override the host, port and database in
// the URL, and a URL without a host or database inherits PGHOST/PGDATABASE.
// Either way the target is not the one the URL names, so refuse them.
const OVERRIDE_PARAMS = ["host", "hostaddr", "port", "dbname", "service"];

export function refuseAmbiguousTarget(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return "the connection string is not a URL";
  }
  const overrides = OVERRIDE_PARAMS.filter((name) =>
    url.searchParams.has(name),
  );
  if (overrides.length > 0)
    return `the URL overrides its target with ?${overrides.join(", ?")}`;
  if (!url.hostname) return "the URL names no host";
  if (!url.pathname.replace(/^\//, "")) return "the URL names no database";
  return null;
}
