/**
 * The signed-in person as the session reports them. The instance role is not
 * here: it comes from `GET /api/user/me` (`useCurrentUser`).
 */
export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  locale?: string | null;
};
