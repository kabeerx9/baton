import { useGetBoard } from "./use-get-board";

/** Looks a workspace member up by id in the board's member list, which the app already loads. */
export function useBoardMemberName(workspaceId: string) {
  const { data } = useGetBoard(workspaceId);
  return (id: string | null | undefined) =>
    (id && data?.members.find((member) => member.id === id)?.name) || null;
}
