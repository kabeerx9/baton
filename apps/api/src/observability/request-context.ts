import { AsyncLocalStorage } from "node:async_hooks";

/** Facts about the in-flight request that every log line carries. */
export type RequestContext = {
  requestId: string;
  workspaceId?: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Runs `fn` with no request context, for work that outlives a request. */
export function exitRequestContext<T>(fn: () => T): T {
  return storage.exit(fn);
}
