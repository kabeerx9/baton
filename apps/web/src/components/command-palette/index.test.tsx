import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommandPalette from "./index";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  shortcuts: {} as Record<string, () => void>,
  workspace: { id: "workspace-1" } as { id: string } | undefined,
}));

vi.mock("react-i18next", () => {
  // Display labels have spaces; ids do not. The palette must filter on the
  // label the user reads, as Base UI did.
  const labels: Record<string, string> = {
    "navigation:commandPalette.suggestions": "Suggestions",
    "navigation:commandPalette.projects": "Projects",
    "navigation:commandPalette.search": "Search",
    "navigation:commandPalette.members": "Members",
    "navigation:commandPalette.createTask": "Create task",
    "navigation:commandPalette.createProject": "Create project",
    "navigation:commandPalette.commands": "Commands",
    "navigation:commandPalette.createWorkspace": "Create workspace",
    "navigation:commandPalette.lightTheme": "Light theme",
    "navigation:commandPalette.darkTheme": "Dark theme",
    "navigation:commandPalette.systemTheme": "System theme",
    "navigation:commandPalette.keyboardShortcuts": "Keyboard shortcuts",
    "navigation:commandPalette.empty": "No results",
    "navigation:commandPalette.inputPlaceholder": "Type a command",
  };
  return { useTranslation: () => ({ t: (key: string) => labels[key] ?? key }) };
});
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/dashboard" }),
  useNavigate: () => m.navigate,
}));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({
  useShortcut: (id: string, handler: () => void) => {
    m.shortcuts[id] = handler;
  },
}));
vi.mock("@/components/shortcuts/shortcut-keys", () => ({
  ShortcutKeys: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: m.workspace }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/queries/user/use-current-user", () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
vi.mock("@/components/search-command-menu", () => ({ default: () => null }));
vi.mock("@/components/board/new-task-dialog", () => ({
  NewTaskDialog: () => null,
}));
vi.mock("@/components/shared/modals/create-workspace-modal", () => ({
  default: () => null,
}));
vi.mock("../shared/modals/create-project-modal", () => ({
  default: () => null,
}));

function openPalette() {
  render(<CommandPalette />);
  act(() => m.shortcuts.openCommandMenu());
}

// UI SDK settles the filtered list in a microtask.
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

async function search(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Type a command" }), {
    target: { value },
  });
  await flush();
}

const names = () => screen.queryAllByRole("option").map((o) => o.textContent);

describe("CommandPalette", () => {
  afterEach(() => {
    cleanup();
    m.navigate.mockReset();
    m.workspace = { id: "workspace-1" };
  });

  it("opens the members page of the active workspace", async () => {
    openPalette();

    fireEvent.click(await screen.findByText("Members"));

    expect(m.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/members",
      params: { workspaceId: "workspace-1" },
    });
  });

  it("stays put without an active workspace", async () => {
    m.workspace = undefined;
    openPalette();

    fireEvent.click(await screen.findByText("Members"));

    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("filters on the visible label, not the item id", async () => {
    openPalette();

    // A multi-word label with spaces finds its item.
    await search("Create task");
    expect(names()).toEqual(["Create task"]);

    // The stable id is not what the user reads, so it does not match.
    await search("create-task");
    expect(names()).toEqual([]);
  });

  it("opens from the shortcut, filters, runs on Enter and leaves focus where it was", async () => {
    render(
      <>
        <button type="button">Opener</button>
        <CommandPalette />
      </>,
    );
    const opener = screen.getByRole("button", { name: "Opener" });
    act(() => opener.focus());
    act(() => m.shortcuts.openCommandMenu());
    await flush();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await search("Create task");
    expect(names()).toEqual(["Create task"]);

    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Type a command" }),
      { key: "Enter" },
    );
    await flush();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    // `finalFocus={false}`: the palette does not hand focus back to whatever
    // the shortcut was pressed from.
    expect(opener).not.toHaveFocus();
  });

  it("clears a non-empty query on the first Escape and closes on the second", async () => {
    openPalette();
    const input = screen.getByRole("combobox", { name: "Type a command" });

    await search("theme");
    expect(names()).toEqual(["Light theme", "Dark theme", "System theme"]);

    fireEvent.keyDown(input, { key: "Escape" });
    await flush();
    expect(input).toHaveValue("");
    expect(names()).toContain("Members");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    await flush();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
