function origin(value: string) {
  return value.replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

/** Public API origin, without `/api`. Discovery and audience use it. */
export const publicApiUrl = origin(
  process.env.BATON_API_URL || "http://localhost:1337",
);
/** Where MCP tools reach the REST API from inside this process. */
export const internalApiUrl = origin(
  process.env.BATON_INTERNAL_API_URL || "http://127.0.0.1:1337",
);
export const clientUrl =
  process.env.BATON_CLIENT_URL || "http://localhost:5173";

export const mcpIssuer = (base = publicApiUrl) => `${base}/api`;
/** RFC 8707 resource: every grant is bound to this audience. */
export const mcpResource = (base = publicApiUrl) => `${base}/api/mcp`;

/**
 * True when a client's `resource` names this MCP endpoint. A trailing slash
 * and a query (such as `?tools=all`) still name the same endpoint.
 */
export function isMcpResource(value: string, base = publicApiUrl): boolean {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    return (
      `${url.origin}${url.pathname.replace(/\/+$/, "")}` === mcpResource(base)
    );
  } catch {
    return false;
  }
}

export function protectedResourceMetadata(base = publicApiUrl) {
  return {
    resource: mcpResource(base),
    authorization_servers: [mcpIssuer(base)],
  };
}

export function authorizationServerMetadata(base = publicApiUrl) {
  return {
    issuer: mcpIssuer(base),
    authorization_endpoint: `${base}/api/mcp/authorize`,
    token_endpoint: `${base}/api/mcp/token`,
    registration_endpoint: `${base}/api/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}
