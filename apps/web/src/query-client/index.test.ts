import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import listRepositories from "@/fetchers/github-integration/list-repositories";
import queryClient from "./index";

const { handleUnauthorized, listRepos } = vi.hoisted(() => ({
  handleUnauthorized: vi.fn(),
  listRepos: vi.fn(),
}));

vi.mock("@baton/libs", () => ({
  client: {
    "github-integration": {
      repositories: { ":projectId": { $get: listRepos } },
    },
  },
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/http-error", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http-error")>()),
  handleUnauthorized,
}));

const githubRejected = () =>
  Response.json(
    {
      message: "Invalid GitHub token or unauthorized.",
      code: "INTEGRATION_AUTH_FAILED",
    },
    { status: 401 },
  );

const sessionRejected = () =>
  Response.json(
    { message: "Unauthorized", code: "UNAUTHORIZED" },
    { status: 401 },
  );

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe("global unauthorized handling", () => {
  it("keeps the Baton session when GitHub rejects access while listing repositories", async () => {
    listRepos.mockResolvedValue(githubRejected());

    await expect(
      queryClient.fetchQuery({
        queryKey: ["github-repositories"],
        queryFn: () => listRepositories("project-1"),
        retry: false,
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "INTEGRATION_AUTH_FAILED",
      message: "Invalid GitHub token or unauthorized.",
    });
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("signs out when Baton rejects the session", async () => {
    listRepos.mockResolvedValue(sessionRejected());

    await expect(
      queryClient.fetchQuery({
        queryKey: ["github-repositories"],
        queryFn: () => listRepositories("project-1"),
      }),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });
});
