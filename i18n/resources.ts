// Baton ships English only.
export const supportedLocales = ["en-US"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export function isSupportedLocale(locale: string): locale is AppLocale {
  return (supportedLocales as readonly string[]).includes(locale);
}

export async function loadLocale(_locale: AppLocale): Promise<object> {
  return (await import("./en-US.json")).default;
}
