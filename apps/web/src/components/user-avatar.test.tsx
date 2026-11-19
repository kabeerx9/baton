import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { signOutState } from "@/lib/sign-out-state";
import { UserAvatar } from "./user-avatar";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    image: null as string | null,
  },
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({ useShortcut: () => {} }));
const signOut = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("@/hooks/mutations/use-sign-out", () => ({
  default: () => ({ mutateAsync: signOut.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/queries/tour/use-replay-tour", () => ({
  useReplayTour: () => ({ mutate: vi.fn() }),
}));

beforeEach(() => {
  auth.user.image = null;
  signOutState.justSignedOut = false;
  signOut.mutateAsync.mockReset();
  signOut.mutateAsync.mockResolvedValue(undefined);
});

describe("UserAvatar", () => {
  it("renders no image when the account has no avatar", async () => {
    const { container } = render(<UserAvatar />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText("JD").length).toBeGreaterThan(0);

    // The menu header draws a second avatar; it must not add an empty image
    // either.
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByText("jane@example.com")).toBeVisible(),
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("hands the confirmation to the sign-in page instead of a toast", async () => {
    render(<UserAvatar />);

    fireEvent.click(screen.getByRole("button"));
    const items = await screen.findAllByRole("menuitem");
    fireEvent.click(items[items.length - 1] as HTMLElement);

    await waitFor(() => expect(signOutState.justSignedOut).toBe(true));
  });

  it("renders the avatar image when the account has one", () => {
    auth.user.image = "/api/user/avatar/abc123";
    const { container } = render(<UserAvatar />);

    expect(container.querySelector("img")).not.toBeNull();
  });
});
