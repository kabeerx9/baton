const DEFAULT_API_PORT = 1337;

/**
 * The port the API listens on: `BATON_API_PORT`, else 1337. Not `PORT`:
 * App Platform sets that for the web container's nginx, which proxies to
 * the API on 1337 inside the hosted image. An invalid value stops startup,
 * so a typo never moves the API to a port nothing proxies to.
 */
export function resolveApiPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_API_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`BATON_API_PORT must be a port number, got "${raw}"`);
  }
  return port;
}
