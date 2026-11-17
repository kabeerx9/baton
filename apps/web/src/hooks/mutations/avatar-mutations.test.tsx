import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useRemoveAdminUserAvatar from "./admin/use-remove-admin-user-avatar";
import useSetAdminUserAvatar from "./admin/use-set-admin-user-avatar";
import useRemoveUserAvatar from "./use-remove-user-avatar";
import useUpdateUserAvatar from "./use-update-user-avatar";

const m = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  setAdminUserAvatar: vi.fn(),
  removeAdminUserAvatar: vi.fn(),
  updateUser: vi.fn(),
  refetch: vi.fn(),
  signedInUserId: "me",
}));

vi.mock("@/fetchers/user/upload-avatar", () => ({ default: m.uploadAvatar }));
vi.mock("@/fetchers/user/delete-avatar", () => ({ default: m.deleteAvatar }));
vi.mock("@/fetchers/admin/set-admin-user-avatar", () => ({
  setAdminUserAvatar: m.setAdminUserAvatar,
}));
vi.mock("@/fetchers/admin/remove-admin-user-avatar", () => ({
  removeAdminUserAvatar: m.removeAdminUserAvatar,
}));
vi.mock("@/lib/prepare-avatar-image", () => ({
  prepareAvatarImage: async () => ({ contentType: "image/png", data: "AAAA" }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    updateUser: m.updateUser,
    $store: {
      atoms: {
        session: {
          get: () => ({
            data: { user: { id: m.signedInUserId } },
            isPending: false,
            refetch: m.refetch,
          }),
        },
      },
    },
  },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let queryClient: QueryClient;
let invalidated: unknown[][];

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render<T>(hook: () => T) {
  return renderHook(hook, { wrapper: Wrapper }).result;
}

const file = new File(["x"], "me.png", { type: "image/png" });

beforeEach(() => {
  vi.resetAllMocks();
  m.signedInUserId = "me";
  m.refetch.mockResolvedValue(undefined);
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  invalidated = [];
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
    async (filters) => {
      invalidated.push([...((filters?.queryKey as unknown[]) ?? [])]);
    },
  );
});

afterEach(() => cleanup());

describe("own avatar mutations", () => {
  it("uploads once, never calls updateUser, then refreshes session and boards", async () => {
    m.uploadAvatar.mockResolvedValue({ id: "a", url: "/api/user/avatar/a" });
    const result = render(useUpdateUserAvatar);

    await act(() => result.current.mutateAsync(file));

    expect(m.uploadAvatar).toHaveBeenCalledWith({
      contentType: "image/png",
      data: "AAAA",
    });
    expect(m.updateUser).not.toHaveBeenCalled();
    expect(m.refetch).toHaveBeenCalledOnce();
    expect(invalidated).toContainEqual(["task-board"]);
    expect(invalidated).toContainEqual(["workspace-users"]);
  });

  it("removes once, never calls updateUser, then refreshes", async () => {
    m.deleteAvatar.mockResolvedValue({ deleted: true });
    const result = render(useRemoveUserAvatar);

    await act(() => result.current.mutateAsync());

    expect(m.deleteAvatar).toHaveBeenCalledOnce();
    expect(m.updateUser).not.toHaveBeenCalled();
    expect(m.refetch).toHaveBeenCalledOnce();
    expect(invalidated).toContainEqual(["task-board"]);
  });

  it("keeps a committed upload a success when the session refresh fails", async () => {
    m.uploadAvatar.mockResolvedValue({ id: "a", url: "/api/user/avatar/a" });
    m.refetch.mockRejectedValue(new Error("offline"));
    const result = render(useUpdateUserAvatar);

    await expect(
      act(() => result.current.mutateAsync(file)),
    ).resolves.toMatchObject({ id: "a" });
    expect(invalidated).toContainEqual(["task-board"]);
  });

  it("reports a failed upload and refreshes nothing", async () => {
    m.uploadAvatar.mockRejectedValue(new Error("Too large"));
    const result = render(useUpdateUserAvatar);

    await expect(act(() => result.current.mutateAsync(file))).rejects.toThrow(
      "Too large",
    );
    expect(m.refetch).not.toHaveBeenCalled();
    expect(invalidated).toEqual([]);
  });
});

describe("admin avatar mutations", () => {
  it("refreshes the session when an admin changes their own picture", async () => {
    m.setAdminUserAvatar.mockResolvedValue({ image: "/api/user/avatar/b" });
    const result = render(useSetAdminUserAvatar);

    await act(() => result.current.mutateAsync({ userId: "me", file }));

    expect(m.refetch).toHaveBeenCalledOnce();
    expect(invalidated).toContainEqual(["task-board"]);
    expect(invalidated).toContainEqual(["admin", "users"]);
  });

  it("leaves the session alone for another user's picture", async () => {
    m.removeAdminUserAvatar.mockResolvedValue({ removed: true });
    const result = render(useRemoveAdminUserAvatar);

    await act(() => result.current.mutateAsync("someone-else"));

    expect(m.refetch).not.toHaveBeenCalled();
    expect(invalidated).toContainEqual(["task-board"]);
  });
});
