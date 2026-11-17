import db from "../../database";
import { clearUserAvatar } from "../avatar-store/clear-user-avatar";

export async function deleteOwnAvatar(userId: string) {
  const { deleted } = await db.transaction((tx) => clearUserAvatar(tx, userId));
  return { deleted };
}

export default deleteOwnAvatar;
