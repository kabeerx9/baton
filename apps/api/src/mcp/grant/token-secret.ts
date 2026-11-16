import { createHash, randomBytes } from "node:crypto";

const PREFIX = "baton_mcp_";
const KIND_PREFIX = { access: `${PREFIX}at_`, refresh: `${PREFIX}rt_` };

export type McpTokenKind = keyof typeof KIND_PREFIX;

/** A 256-bit random token. The prefix lets auth code route it without a lookup. */
export function newMcpToken(kind: McpTokenKind): string {
  return `${KIND_PREFIX[kind]}${randomBytes(32).toString("base64url")}`;
}

/** Only this hash is stored; the token itself never reaches the database. */
export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isMcpToken(token: string): boolean {
  return token.startsWith(PREFIX);
}

export function isMcpTokenOfKind(token: string, kind: McpTokenKind): boolean {
  return token.startsWith(KIND_PREFIX[kind]);
}
