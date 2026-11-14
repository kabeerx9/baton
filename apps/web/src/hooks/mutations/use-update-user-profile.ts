import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";

type UpdateUserProfileRequest = {
  name?: string;
};

function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: UpdateUserProfileRequest) => {
      const { data, error } = await authClient.updateUser({ name });

      if (error) {
        throw new Error(error.message || "Failed to update user profile");
      }

      return data;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}

export default useUpdateUserProfile;
