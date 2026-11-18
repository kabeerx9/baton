import { batonIdentityHooks } from "./baton-hooks";
import { createBetterAuthIdentity } from "./better-auth/adapter";
import { auth } from "./better-auth/auth";
import type { IdentityProvider } from "./port";

export type * from "./port";

let configured: IdentityProvider | undefined;
let override: IdentityProvider | null = null;

/**
 * Which adapter `identity` forwards to. A getter, so tests can swap it with
 * `setIdentityForTests` or spy on it and have `vi.restoreAllMocks` undo that.
 */
export const identityHolder = {
  get current(): IdentityProvider {
    if (override) return override;
    configured ??= createBetterAuthIdentity(auth, batonIdentityHooks);
    return configured;
  },
};

function forward<T extends object>(read: () => T): T {
  return new Proxy({} as T, {
    get(_, key) {
      const target = read();
      const value = Reflect.get(target, key);
      if (typeof value === "function") return value.bind(target);
      if (value && typeof value === "object")
        return forward(() => Reflect.get(read(), key) as object);
      return value;
    },
  });
}

/** The configured identity provider. The only way Baton reaches the provider. */
export const identity: IdentityProvider = forward(() => identityHolder.current);

/** Replace the adapter until called again with null. Tests only. */
export function setIdentityForTests(adapter: IdentityProvider | null) {
  override = adapter;
}
