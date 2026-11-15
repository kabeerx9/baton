import type { Scenario } from "./types";

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

const URL_BY_SCENARIO: Record<Scenario, string> = {
  normal: "https://baton.wicketry.dev/api/mcp",
  empty: "https://baton.wicketry.dev/api/mcp",
  loading: "https://baton.wicketry.dev/api/mcp",
  error: "https://baton.wicketry.dev/api/mcp",
  localhost: "http://localhost:1337/api/mcp",
  lan: "http://192.168.1.24:1337/api/mcp",
};

export function instanceFor(scenario: Scenario): Instance {
  const url = URL_BY_SCENARIO[scenario] ?? URL_BY_SCENARIO.normal;
  return { url, kind: classifyUrl(url) };
}
