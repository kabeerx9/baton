import { getApiUrl } from "@/fetchers/get-api-url";

export type InstanceKind = "https" | "loopback" | "http-remote";

export type Instance = { url: string; kind: InstanceKind };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https is fine anywhere; plain http works on loopback only. Unparseable is the unsafe kind. */
export function classifyUrl(url: string): InstanceKind {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return "https";
    return LOOPBACK_HOSTS.has(parsed.hostname) ? "loopback" : "http-remote";
  } catch {
    return "http-remote";
  }
}

/**
 * The MCP URL for this instance: `<api origin>/api/mcp`. It follows the API
 * address the app already uses, so a separately hosted API works. A relative
 * API address resolves against the page origin (bundled, same-origin).
 */
export function mcpInstance(pageOrigin: string): Instance {
  const url = new URL(getApiUrl("/mcp"), pageOrigin).toString();
  return { url, kind: classifyUrl(url) };
}
