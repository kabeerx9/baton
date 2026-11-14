/** Reads a stored pull-request external link into the board shape. */
export function parsePullRequest(link: {
  externalId: string;
  url: string;
  metadata: string | null;
}) {
  const number = Number.parseInt(link.externalId, 10);
  if (!Number.isFinite(number)) return null;
  let meta: { state?: string; merged?: boolean } = {};
  try {
    meta = link.metadata ? JSON.parse(link.metadata) : {};
  } catch {
    meta = {};
  }
  const state: "open" | "closed" | "merged" = meta.merged
    ? "merged"
    : meta.state === "closed"
      ? "closed"
      : "open";
  return { number, url: link.url, state };
}
