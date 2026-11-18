import type { QueryClient } from "@tanstack/react-query";

const USER_PROFILE_QUERY_KEYS = [
  ["workspace-users"],
  ["activities"],
  ["tasks"],
  ["task"],
  // Board members and assignees carry their picture.
  ["task-board"],
] as const;

export async function invalidateUserProfileQueries(queryClient: QueryClient) {
  await Promise.all(
    USER_PROFILE_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export default invalidateUserProfileQueries;
