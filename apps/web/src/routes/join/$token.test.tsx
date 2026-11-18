import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { hasJoinIntent, rememberJoinIntent } from "@/lib/join-link";

const TOKEN = "Ab3_-Zx9".repeat(5) + "Abc";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  session: { user: null as null | { email: string } },
  sessionLoading: false,
  preview: {} as Record<string, unknown>,
  join: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null as unknown,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ token: TOKEN }),
  }),
  useNavigate: () => m.navigate,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/dashboard">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values?.workspaceName ? `${key}:${values.workspaceName}` : key,
  }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/auth/use-settled-session", () => ({
  useSettledSession: () => ({
    session: m.session.user ? { user: m.session.user } : null,
    isLoading: m.sessionLoading,
  }),
}));
vi.mock("@/hooks/queries/join-link/use-join-link-preview", () => ({
  useJoinLinkPreview: () => m.preview,
}));
vi.mock("@/hooks/mutations/join-link/use-join-workspace", () => ({
  useJoinWorkspace: () => m.join,
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

import { Route } from "./$token";

const Page = (Route as unknown as { component: () => React.ReactElement })
  .component;

const activePreview = {
  isPending: false,
  isError: false,
  data: {
    status: "active",
    workspace: { name: "Shortcon" },
    sharedBy: { name: "Kabeer" },
    expiresAt: "2026-11-19T00:00:00.000Z",
  },
};

beforeEach(() => {
  window.sessionStorage.clear();
  m.session.user = null;
  m.sessionLoading = false;
  m.preview = activePreview;
  m.join = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("join route", () => {
  it("remembers the token before sending a visitor to sign up, and carries the redirect", () => {
    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: "joinLink:page.signUp" }),
    );
    expect(hasJoinIntent(TOKEN)).toBe(true);
    expect(m.navigate).toHaveBeenCalledWith({
      to: "/auth/sign-up",
      search: { redirect: `/join/${TOKEN}` },
    });
  });

  it("joins once, by itself, when a sign-up round trip left the intent", async () => {
    rememberJoinIntent(TOKEN);
    m.session.user = { email: "maya@example.com" };
    const { rerender } = render(<Page />);
    await waitFor(() => expect(m.join.mutate).toHaveBeenCalledTimes(1));
    expect(m.join.mutate.mock.calls[0]?.[0]).toBe(TOKEN);
    expect(hasJoinIntent(TOKEN)).toBe(false);
    rerender(<Page />);
    expect(m.join.mutate).toHaveBeenCalledTimes(1);
  });

  it("does not join without a click when there is no intent", () => {
    m.session.user = { email: "maya@example.com" };
    render(<Page />);
    expect(m.join.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /joinLink:page.join/ }));
    expect(m.join.mutate).toHaveBeenCalledTimes(1);
  });

  it("ignores an intent for a different link", () => {
    rememberJoinIntent("another-token");
    m.session.user = { email: "maya@example.com" };
    render(<Page />);
    expect(m.join.mutate).not.toHaveBeenCalled();
  });

  it("never joins on an unavailable link, even with an intent", () => {
    rememberJoinIntent(TOKEN);
    m.session.user = { email: "maya@example.com" };
    m.preview = {
      isPending: false,
      isError: false,
      data: { status: "unavailable", reason: "expired" },
    };
    render(<Page />);
    expect(m.join.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("joinLink:page.unavailable.expired.title"),
    ).toBeTruthy();
  });

  it("shows the server's message for a removed member and offers no retry", () => {
    m.session.user = { email: "maya@example.com" };
    m.join = {
      ...m.join,
      isError: true,
      error: new HttpError(
        403,
        "You were removed from this workspace. Ask an admin for a new link.",
        {
          code: "REMOVED_FROM_WORKSPACE",
        },
      ),
    };
    render(<Page />);
    expect(
      screen.getByText(
        "You were removed from this workspace. Ask an admin for a new link.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /joinLink:page.join/ }),
    ).toBeNull();
  });
});
