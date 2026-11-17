import { useMutation, useQueryClient } from "@tanstack/react-query";
import uploadAvatar from "@/fetchers/user/upload-avatar";
import { prepareAvatarImage } from "@/lib/prepare-avatar-image";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";
import refreshSession from "./refresh-session";

/** The server stores the picture and sets `user.image` in one request. */
function useUpdateUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) =>
      uploadAvatar(await prepareAvatarImage(file)),
    onSuccess: () =>
      Promise.all([
        refreshSession(),
        invalidateUserProfileQueries(queryClient),
      ]),
  });
}

export default useUpdateUserAvatar;
