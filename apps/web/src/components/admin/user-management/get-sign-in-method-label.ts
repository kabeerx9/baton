type Translate = (key: string) => string;

const METHOD_LABEL_KEYS = new Map([
  ["credential", "settings:adminUsers.details.methods.password"],
  ["github", "auth:providers.github"],
]);

/** Human name for an account provider id; unknown ids show as they are. */
export function getSignInMethodLabel(method: string, t: Translate) {
  const key = METHOD_LABEL_KEYS.get(method);
  return key ? t(key) : method;
}
