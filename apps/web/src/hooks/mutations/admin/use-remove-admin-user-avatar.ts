import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageMinusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { removeAdminUserAvatar } from "@/fetchers/admin/remove-admin-user-avatar";
import { toast } from "@/lib/toast";
import refreshAfterAdminAvatarChange from "./refresh-after-admin-avatar-change";

function useRemoveAdminUserAvatar() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeAdminUserAvatar,
    onSuccess: (_result, userId) => {
      toast.success(t("settings:adminUsers.toast.avatarRemoved"), {
        icon: ImageMinusIcon,
      });
      return refreshAfterAdminAvatarChange(queryClient, userId);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.avatarError"),
      );
    },
  });
}

export default useRemoveAdminUserAvatar;
