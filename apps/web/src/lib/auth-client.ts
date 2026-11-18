import { createAuthClient } from "better-auth/react";

const getBaseURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:1337";
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/");
  }
};

// Identity only: sign-in, session, password, account link. Workspaces,
// members and roles are Baton routes read through `@baton/libs`.
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
});
