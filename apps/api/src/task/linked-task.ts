/** Another task named in a response: enough to show and open it. */
export type LinkedTask = {
  id: string;
  key: string;
  title: string;
  assigneeName: string | null;
};

/** The key people say out loud: repo prefix and number, for example API-3. */
export function taskKey(slug: string, number: number | null) {
  return `${slug}-${number ?? "?"}`;
}
