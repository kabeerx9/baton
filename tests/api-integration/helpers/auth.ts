import type { Session, User } from "better-auth/types";
import { vi } from "vite-plus/test";
import { identityHolder } from "../../../apps/api/src/identity";
import { batonIdentityHooks } from "../../../apps/api/src/identity/baton-hooks";
import { createBetterAuthIdentity } from "../../../apps/api/src/identity/better-auth/adapter";
import { auth } from "../../../apps/api/src/identity/better-auth/auth";
import {
  createFakeIdentity,
  type FakeIdentity,
  type FakeIdentityOptions,
} from "../../../apps/api/src/identity/fake";

function createSession(userId: string): Session {
  const now = new Date();

  return {
    id: `session-${userId}`,
    token: `token-${userId}`,
    userId,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
  };
}

/**
 * Swap Baton's identity provider for the fake until `vi.restoreAllMocks`.
 * The provider's own routes still answer through Better Auth.
 */
export function installFakeIdentity(
  options: Omit<FakeIdentityOptions, "hooks" | "handle"> = {},
): FakeIdentity {
  const fake = createFakeIdentity({
    hooks: batonIdentityHooks,
    handle: (request) => auth.handler(request),
    ...options,
  });
  vi.spyOn(identityHolder, "current", "get").mockReturnValue(fake);
  return fake;
}

/**
 * Fake only who is signed in, as the old `getSession` spy did. Sessions,
 * accounts and the fence still read the provider's rows, which these tests
 * seed directly (admin-overview, github-binding-routes). The full fake runs
 * in the contract suite and websocket-security.
 */
function installSignedInAs(signedInAs: FakeIdentityOptions["signedInAs"]) {
  const fake = createFakeIdentity({ hooks: batonIdentityHooks, signedInAs });
  const real = createBetterAuthIdentity(auth, batonIdentityHooks);
  vi.spyOn(identityHolder, "current", "get").mockReturnValue({
    ...real,
    resolve: (headers) => fake.resolve(headers),
  });
}

export function mockAuthenticatedSession(user: User) {
  const session = createSession(user.id);
  installSignedInAs({
    identity: {
      userId: user.id,
      subject: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    },
    sessionId: session.id,
  });
  // The provider's own hooks still read the session through getSession.
  return vi
    .spyOn(auth.api, "getSession")
    .mockResolvedValue({ session, user } as never);
}

export function mockAnonymousSession() {
  installSignedInAs(undefined);
  return vi.spyOn(auth.api, "getSession").mockResolvedValue(null);
}
