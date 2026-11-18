import type { IdentityProvider } from "./port";

export type * from "./port";

let configured: Promise<IdentityProvider> | undefined;
let override: IdentityProvider | null = null;

/**
 * Loaded on first use, so importing `identity` (ws, GitHub, MCP) does not
 * pull the provider and its hooks into every module graph.
 */
async function configure(): Promise<IdentityProvider> {
  const [{ createBetterAuthIdentity }, { auth }, { batonIdentityHooks }] =
    await Promise.all([
      import("./better-auth/adapter"),
      import("./better-auth/auth"),
      import("./baton-hooks"),
    ]);
  return createBetterAuthIdentity(auth, batonIdentityHooks);
}

/**
 * Which adapter `identity` forwards to. A getter, so tests can swap it with
 * `setIdentityForTests` or spy on it and have `vi.restoreAllMocks` undo that.
 */
export const identityHolder = {
  get current(): IdentityProvider | Promise<IdentityProvider> {
    if (override) return override;
    configured ??= configure();
    return configured;
  },
};

// Every port method is async, so each call can wait for the adapter.
function forward(path: PropertyKey[]): unknown {
  const call = async (...args: unknown[]) => {
    let owner: unknown = await identityHolder.current;
    for (const key of path.slice(0, -1))
      owner = Reflect.get(owner as object, key);
    const method = Reflect.get(owner as object, path.at(-1)!) as (
      ...args: unknown[]
    ) => unknown;
    return method.apply(owner, args);
  };
  return new Proxy(call, {
    // Not a thenable: `await identity` must not call into the adapter.
    get: (_, key) => (key === "then" ? undefined : forward([...path, key])),
  });
}

/** The configured identity provider. The only way Baton reaches the provider. */
export const identity = forward([]) as IdentityProvider;

/** Replace the adapter until called again with null. Tests only. */
export function setIdentityForTests(adapter: IdentityProvider | null) {
  override = adapter;
}
