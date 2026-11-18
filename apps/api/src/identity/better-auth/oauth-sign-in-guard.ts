import { APIError } from "better-auth/api";

export function oauthSignInRefused() {
  return new APIError("FORBIDDEN", {
    code: "OAUTH_SIGN_IN_DISABLED",
    message:
      "Sign in with your email and password. GitHub can only be linked to an account that is already signed in.",
  });
}

/**
 * Refuse a session that an OAuth flow would start. Linking GitHub to a
 * signed-in user finishes on the callback without creating a session, so
 * only sign-in (and the sign-up behind it) reaches this refusal.
 */
export function assertNoOAuthSignIn(path: string | undefined) {
  if (path === "/sign-in/social" || path?.startsWith("/callback/")) {
    throw oauthSignInRefused();
  }
}

/** True when a stored OAuth state came from `/link-social`. */
export function isLinkState(value: string | undefined) {
  if (!value) return false;
  try {
    const link = (JSON.parse(value) as { link?: { userId?: unknown } }).link;
    return typeof link?.userId === "string" && link.userId.length > 0;
  } catch {
    return false;
  }
}

type CallbackContext = {
  path: string;
  query?: Record<string, unknown> | null;
  body?: unknown;
  context: {
    internalAdapter: {
      findVerificationValue: (
        identifier: string,
      ) => Promise<{ value: string } | null | undefined>;
    };
  };
};

/**
 * Refuse an OAuth callback that is not finishing a `/link-social` flow.
 * better-auth links or refreshes an account before it creates a session, so
 * a sign-in callback must stop here, before any account or user write.
 * State lives in the verification table (`storeStateStrategy: "database"`).
 */
export async function assertOAuthCallbackLinks(ctx: CallbackContext) {
  if (!ctx.path.startsWith("/callback/")) return;
  const body = ctx.body as { state?: unknown } | undefined;
  const state = ctx.query?.state ?? body?.state;
  if (typeof state !== "string" || !state) throw oauthSignInRefused();
  const stored = await ctx.context.internalAdapter.findVerificationValue(
    `auth-state:${state}`,
  );
  if (!isLinkState(stored?.value)) throw oauthSignInRefused();
}
