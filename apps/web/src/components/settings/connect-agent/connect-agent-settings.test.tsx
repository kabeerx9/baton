import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { McpGrant, McpGrantsPage } from "@/fetchers/mcp/list-grants";
import { ConnectAgentSettings } from "./connect-agent-settings";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/copy-to-clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const grant = (id: string, over: Partial<McpGrant> = {}): McpGrant => ({
  id,
  clientName: `Agent ${id}`,
  workspace: null,
  createdAt: "2026-11-01T00:00:00Z",
  lastUsedAt: "2026-11-10T00:00:00Z",
  ...over,
});

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** A fake API holding live grants. DELETE removes one, or answers with `deleteStatus`. */
function fakeApi(
  initial: McpGrant[],
  opts: { pageSize?: number; deleteStatus?: number; listStatus?: number } = {},
) {
  let live = initial;
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (init?.method === "DELETE") {
      const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      if (opts.deleteStatus === 404) {
        live = live.filter((g) => g.id !== id);
        return json({ message: "Grant not found" }, 404);
      }
      if (opts.deleteStatus)
        return json({ message: "boom" }, opts.deleteStatus);
      live = live.filter((g) => g.id !== id);
      return new Response(null, { status: 204 });
    }
    if (opts.listStatus) return json({ message: "boom" }, opts.listStatus);
    const size = opts.pageSize ?? 20;
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const next = start + size;
    const page: McpGrantsPage = {
      grants: live.slice(start, next),
      nextCursor: next < live.length ? String(next) : null,
    };
    return json(page);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConnectAgentSettings />
    </QueryClientProvider>,
  );
}

const deleteCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("connected agents list", () => {
  it("shows skeleton rows while loading", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect((await screen.findAllByTestId("settings-row-skeleton")).length).toBe(
      3,
    );
  });

  it("shows the empty state", async () => {
    fakeApi([]);
    renderPage();
    expect(
      await screen.findByText("settings:connectAgent.grants.emptyTitle"),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry that loads the list", async () => {
    fakeApi([grant("a")], { listStatus: 500 });
    renderPage();
    expect(
      await screen.findByText("settings:connectAgent.grants.loadError"),
    ).toBeInTheDocument();
    fakeApi([grant("a")]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:connectAgent.grants.retry",
      }),
    );
    expect(await screen.findByText("Agent a")).toBeInTheDocument();
  });

  it("follows nextCursor with Show more", async () => {
    fakeApi([grant("a"), grant("b"), grant("c")], { pageSize: 2 });
    renderPage();
    expect(await screen.findByText("Agent b")).toBeInTheDocument();
    expect(screen.queryByText("Agent c")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:connectAgent.grants.showMore",
      }),
    );
    expect(await screen.findByText("Agent c")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "settings:connectAgent.grants.showMore",
      }),
    ).not.toBeInTheDocument();
  });

  it("says when a grant has no default workspace", async () => {
    fakeApi([grant("a")]);
    renderPage();
    await screen.findByText("Agent a");
    expect(
      screen.getByText("settings:connectAgent.grants.details"),
    ).toBeInTheDocument();
  });
});

describe("revoke flow", () => {
  const openDialog = async (name: string) => {
    fireEvent.click(
      await screen.findByRole("button", {
        name: `settings:connectAgent.grants.revokeLabel:${name}`,
      }),
    );
    return screen.findByRole("alertdialog");
  };
  const confirm = (dialog: HTMLElement) =>
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:connectAgent.revoke.confirm",
      }),
    );

  it("asks first, then deletes and the row disappears", async () => {
    fakeApi([grant("a"), grant("b")]);
    renderPage();
    const dialog = await openDialog("Agent a");
    expect(deleteCalls()).toHaveLength(0);

    confirm(dialog);

    await waitFor(() =>
      expect(screen.queryByText("Agent a")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Agent b")).toBeInTheDocument();
    expect(deleteCalls()).toHaveLength(1);
    expect(String(deleteCalls()[0]?.[0])).toMatch(/\/mcp\/grants\/a$/);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("does not delete when cancelled", async () => {
    fakeApi([grant("a")]);
    renderPage();
    const dialog = await openDialog("Agent a");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(deleteCalls()).toHaveLength(0);
    expect(screen.getByText("Agent a")).toBeInTheDocument();
  });

  it("treats a 404 as gone and refetches", async () => {
    fakeApi([grant("a"), grant("b")], { deleteStatus: 404 });
    renderPage();
    confirm(await openDialog("Agent a"));

    await waitFor(() =>
      expect(screen.queryByText("Agent a")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Agent b")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the row and offers a retry when the revoke fails", async () => {
    fakeApi([grant("a")], { deleteStatus: 500 });
    renderPage();
    const dialog = await openDialog("Agent a");
    confirm(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "settings:connectAgent.revoke.error",
    );
    expect(screen.getByText("Agent a")).toBeInTheDocument();

    fakeApi([grant("a")]);
    confirm(dialog);
    await waitFor(() =>
      expect(screen.queryByText("Agent a")).not.toBeInTheDocument(),
    );
  });
});
