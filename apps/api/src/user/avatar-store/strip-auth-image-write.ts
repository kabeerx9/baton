/**
 * Only the avatar routes write `user.image`. Better Auth passes each update
 * hook the original data object and merges a hook's returned `data` over it,
 * so a returned copy without `image` would not remove it. Delete it in place.
 */
export function stripAuthImageWrite(data: Record<string, unknown>) {
  delete data.image;
}
