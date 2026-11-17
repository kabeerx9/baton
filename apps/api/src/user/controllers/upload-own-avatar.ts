import db from "../../database";
import { parseAvatarUpload } from "../avatar-store/parse-avatar-upload";
import { replaceUserAvatar } from "../avatar-store/replace-user-avatar";

export async function uploadOwnAvatar(
  userId: string,
  upload: { contentType: string; data: string },
) {
  const decoded = parseAvatarUpload(upload);
  const { avatar } = await db.transaction((tx) =>
    replaceUserAvatar(tx, userId, decoded),
  );
  return avatar;
}

export default uploadOwnAvatar;
