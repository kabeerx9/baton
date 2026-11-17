import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAvatar from "@/fetchers/user/delete-avatar";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";
import refreshSession from "./refresh-session";

/** The server deletes the picture and clears `user.image` in one request. */
function useRemoveUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAvatar(),
    onSuccess: () =>
      Promise.all([
        refreshSession(),
        invalidateUserProfileQueries(queryClient),
      ]),
  });
}

export default useRemoveUserAvatar;
