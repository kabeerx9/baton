import { randomUUID } from "node:crypto";

// Letters, digits and - _ . : only, so a client-sent id cannot inject log
// fields, headers or markup. Long enough for UUIDs and trace ids.
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,63}$/;

/** Keeps a safe incoming X-Request-Id, otherwise makes a new one. */
export function acceptRequestId(incoming: string | undefined): string {
  return incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}
