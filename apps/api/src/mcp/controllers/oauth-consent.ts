import { HTTPException } from "hono/http-exception";
import { publishEvent } from "../../events";
import type { z } from "../../openapi";
import { getUserSession } from "../../utils/get-user-session";
import listWorkspaces from "../../workspace/controllers/list-workspaces";
import {
  consumeAuthorizationRequest,
  createAuthCode,
  createAuthorizationRequest,
  getAuthorizationRequest,
  getClient,
  registerClient,
} from "../oauth";
import { reconnectPageResponse } from "../reconnect-page";
import { redirectUriMatches } from "../redirect-uri-matches";
import type {
  authorizationDecisionSchema,
  authorizationQuerySchema,
  clientRegistrationSchema,
} from "../schemas";
import { clientUrl, isMcpResource, mcpIssuer } from "../urls";

type ClientRegistrationInput = z.infer<typeof clientRegistrationSchema>;
type AuthorizationInput = z.infer<typeof authorizationQuerySchema>;
type AuthorizationDecisionInput = z.infer<typeof authorizationDecisionSchema>;

type OAuthErrorStatus = 400 | 401 | 403 | 404;

function throwOAuthError(status: OAuthErrorStatus, error: string): never {
  throw new HTTPException(status, {
    res: Response.json({ error }, { status }),
  });
}

function buildAuthorizationRedirect(
  request: { redirectUri: string; state?: string },
  params: Record<string, string>,
): string {
  const url = new URL(request.redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (request.state !== undefined) {
    url.searchParams.set("state", request.state);
  }
  // RFC 9207: lets the client check which server answered.
  url.searchParams.set("iss", mcpIssuer());
  return url.toString();
}

function isTrustedConsentOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(clientUrl).origin;
  } catch {
    return false;
  }
}

/**
 * The grant's default workspace: the one picked on the consent page (it must
 * be one the user can read), else their only workspace, else none.
 */
async function chooseDefaultWorkspace(
  userId: string,
  picked: string | null,
): Promise<string | null> {
  const workspaces = await listWorkspaces(userId);
  if (picked) {
    if (!workspaces.some((workspace) => workspace.id === picked)) {
      throwOAuthError(400, "invalid_workspace");
    }
    return picked;
  }
  return workspaces.length === 1 ? (workspaces[0]?.id ?? null) : null;
}

export async function registerMcpClient(input: ClientRegistrationInput) {
  const client = await registerClient({
    redirectUris: input.redirect_uris,
    clientName: input.client_name,
  });

  return {
    client_id: client.clientId,
    client_id_issued_at: client.issuedAt,
    redirect_uris: client.redirectUris,
    client_name: client.clientName,
    token_endpoint_auth_method: "none" as const,
    grant_types: ["authorization_code" as const, "refresh_token" as const],
    response_types: ["code" as const],
  };
}

export async function beginMcpAuthorization(
  input: AuthorizationInput,
): Promise<string> {
  const client = await getClient(input.client_id);
  if (!client) {
    // A person sees this in the browser, not the agent: explain what to do.
    throw new HTTPException(400, { res: reconnectPageResponse() });
  }
  if (
    !client.redirectUris.some((uri) =>
      redirectUriMatches(uri, input.redirect_uri),
    )
  ) {
    throwOAuthError(400, "invalid_redirect_uri");
  }
  // RFC 8707: once the redirect is trusted, report a wrong audience there.
  if (input.resource !== undefined && !isMcpResource(input.resource)) {
    return buildAuthorizationRedirect(
      { redirectUri: input.redirect_uri, state: input.state },
      { error: "invalid_target" },
    );
  }

  const requestId = await createAuthorizationRequest({
    clientId: input.client_id,
    codeChallenge: input.code_challenge,
    redirectUri: input.redirect_uri,
    state: input.state,
  });
  const consentUrl = new URL("/mcp/authorize", clientUrl);
  consentUrl.searchParams.set("request_id", requestId);
  return consentUrl.toString();
}

export async function getMcpAuthorizationRequest(requestId: string) {
  const request = await getAuthorizationRequest(requestId);
  if (!request) throwOAuthError(404, "invalid_or_expired_request");

  const client = await getClient(request.clientId);
  if (!client) throwOAuthError(400, "invalid_client");

  return {
    client_name: client.clientName ?? "MCP client",
    redirect_uri: request.redirectUri,
  };
}

export async function decideMcpAuthorizationRequest(params: {
  requestId: string;
  decision: AuthorizationDecisionInput;
  headers: Headers;
  origin?: string;
}): Promise<string> {
  if (!isTrustedConsentOrigin(params.origin)) {
    throwOAuthError(403, "invalid_origin");
  }

  const caller = await getUserSession(params.headers);
  if (!caller) throwOAuthError(401, "unauthorized");
  const userId = caller.identity.userId;

  const request = await getAuthorizationRequest(params.requestId);
  if (!request) throwOAuthError(404, "invalid_or_expired_request");

  const client = await getClient(request.clientId);
  if (
    !client?.redirectUris.some((uri) =>
      redirectUriMatches(uri, request.redirectUri),
    )
  ) {
    throwOAuthError(400, "invalid_client");
  }

  if (!params.decision.approved) {
    if (!(await consumeAuthorizationRequest(params.requestId)))
      throwOAuthError(404, "invalid_or_expired_request");
    return buildAuthorizationRedirect(request, { error: "access_denied" });
  }

  const defaultWorkspaceId = await chooseDefaultWorkspace(
    userId,
    params.decision.workspaceId ?? null,
  );
  const code = await createAuthCode(
    {
      clientId: request.clientId,
      userId: userId,
      sessionId: caller.sessionId,
      codeChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
      defaultWorkspaceId,
    },
    params.requestId,
  );
  await publishEvent("mcp.authorization_code_issued", {
    clientId: request.clientId,
    userId: userId,
    redirectUri: request.redirectUri,
  });
  return buildAuthorizationRedirect(request, { code });
}
