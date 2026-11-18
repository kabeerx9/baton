import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiKey } from "@/fetchers/api-key/create-api-key";

function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export default useCreateApiKey;
