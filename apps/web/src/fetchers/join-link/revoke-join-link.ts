// TODO(after backend merge): call `client["join-link"]` through @baton/libs,
// map `!response.ok` with `HttpError.fromResponse`, and drop the cast. The
// typed client has no join-link routes until the API merges.
export async function revokeJoinLink(_workspaceId: string): Promise<null> {
  throw new Error("revokeJoinLink is not wired to the API yet");
}
