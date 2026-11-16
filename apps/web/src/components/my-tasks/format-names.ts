import i18n from "i18next";

/** "Priya", "Priya and Rohan", "Priya, Rohan, and Meera", in the app's language. */
export function formatNames(names: readonly string[]): string {
  return new Intl.ListFormat(i18n.language || "en-US", {
    style: "long",
    type: "conjunction",
  }).format(names);
}
