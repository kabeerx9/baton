/** "owner/name" from a GitHub integration config, or null when it is unreadable. */
export function parseRepository(config: string) {
  try {
    const parsed = JSON.parse(config) as {
      repositoryOwner?: string;
      repositoryName?: string;
    };
    return parsed.repositoryOwner && parsed.repositoryName
      ? `${parsed.repositoryOwner}/${parsed.repositoryName}`
      : null;
  } catch {
    return null;
  }
}
