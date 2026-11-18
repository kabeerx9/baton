import type { JoinLinkPreview } from "./types";

// TODO(after backend merge): call `client["join-link"]` through @baton/libs,
// map `!response.ok` with `HttpError.fromResponse`, and drop the cast. The
// typed client has no join-link routes until the API merges.
export async function previewJoinLink(
  _token: string,
): Promise<JoinLinkPreview> {
  throw new Error("previewJoinLink is not wired to the API yet");
}
