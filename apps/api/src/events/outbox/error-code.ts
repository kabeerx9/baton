const MAX_ERROR_LENGTH = 200;

/**
 * An error class or code, never the message: database errors can quote
 * the payload.
 */
export function errorCode(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code)
      return code.slice(0, MAX_ERROR_LENGTH);
    current = (current as { cause?: unknown }).cause;
  }
  const name = (error as { name?: unknown } | null)?.name;
  return (typeof name === "string" && name ? name : "Error").slice(
    0,
    MAX_ERROR_LENGTH,
  );
}
