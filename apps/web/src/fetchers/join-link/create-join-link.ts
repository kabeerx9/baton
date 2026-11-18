import type { CreateJoinLinkInput, JoinLink } from "./types";

// TODO(after backend merge): call `client["join-link"]` through @baton/libs,
// map `!response.ok` with `HttpError.fromResponse`, and drop the cast. The
// typed client has no join-link routes until the API merges.
export async function createJoinLink(
  _workspaceId: string,
  _input: CreateJoinLinkInput,
): Promise<JoinLink> {
  throw new Error("createJoinLink is not wired to the API yet");
}
