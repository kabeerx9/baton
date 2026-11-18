import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteApiKey } from "@/fetchers/api-key/delete-api-key";

function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export default useDeleteApiKey;
