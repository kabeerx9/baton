import { isMcpResource } from "./urls";

export type TokenRequest =
  | {
      kind: "authorization_code";
      code: string;
      clientId: string;
      codeVerifier: string;
      redirectUri: string;
    }
  | { kind: "refresh_token"; refreshToken: string; clientId: string };

export type TokenRequestError =
  | "invalid_request"
  | "unsupported_grant_type"
  | "invalid_target";

// RFC 7636 section 4.1: 43 to 128 unreserved characters.
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

/** Validate /token parameters into one request shape, or an OAuth error code. */
export function parseTokenRequest(
  params: Record<string, unknown>,
): TokenRequest | { kind: "error"; error: TokenRequestError } {
  const fail = (error: TokenRequestError) => ({
    kind: "error" as const,
    error,
  });
  const { grant_type, client_id, resource } = params;
  if (grant_type !== "authorization_code" && grant_type !== "refresh_token") {
    return fail("unsupported_grant_type");
  }
  if (!text(client_id, 128)) return fail("invalid_request");
  if (resource !== undefined) {
    if (typeof resource !== "string") return fail("invalid_request");
    if (!isMcpResource(resource)) return fail("invalid_target");
  }
  if (grant_type === "refresh_token") {
    const { refresh_token } = params;
    if (!text(refresh_token, 256)) return fail("invalid_request");
    return {
      kind: "refresh_token",
      refreshToken: refresh_token,
      clientId: client_id,
    };
  }
  const { code, code_verifier, redirect_uri } = params;
  if (
    !text(code, 128) ||
    typeof code_verifier !== "string" ||
    !CODE_VERIFIER.test(code_verifier) ||
    !text(redirect_uri, 2048)
  ) {
    return fail("invalid_request");
  }
  return {
    kind: "authorization_code",
    code,
    clientId: client_id,
    codeVerifier: code_verifier,
    redirectUri: redirect_uri,
  };
}
