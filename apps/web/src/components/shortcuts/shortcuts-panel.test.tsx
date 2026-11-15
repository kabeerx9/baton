import {
  act,
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
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { ShortcutsPanel } from "./shortcuts-panel";
import { useShortcutsPanelStore } from "./shortcuts-panel-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  useShortcutsPanelStore.setState({ open: false });
});

afterEach(() => {
  cleanup();
});

const renderPanel = () =>
  render(
    <ShortcutTestWrapper>
      <ShortcutsPanel />
    </ShortcutTestWrapper>,
  );

const hasRow = (label: string) =>
  screen
    .queryAllByRole("listitem")
    .some((row) => row.textContent?.startsWith(label));

const search = () =>
  screen.getByLabelText("navigation:shortcuts.searchPlaceholder");

describe("ShortcutsPanel", () => {
  it("opens with ? and lists the catalog by section", async () => {
    renderPanel();
    fireEvent.keyDown(document.body, {
      key: "?",
      code: "Slash",
      shiftKey: true,
    });
    expect(
      await screen.findByText("navigation:shortcuts.categories.navigation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("navigation:shortcuts.items.goToInbox"),
    ).toBeInTheDocument();
  });

  it("filters by label and by key name", async () => {
    useShortcutsPanelStore.setState({ open: true });
    renderPanel();
    fireEvent.change(
      await screen.findByLabelText("navigation:shortcuts.searchPlaceholder"),
      {
        target: { value: "inbox" },
      },
    );
    expect(hasRow("navigation:shortcuts.items.goToInbox")).toBe(true);
    expect(hasRow("navigation:shortcuts.items.createTask")).toBe(false);

    fireEvent.change(search(), { target: { value: "ctrl" } });
    expect(hasRow("navigation:shortcuts.items.openCommandMenu")).toBe(true);
    expect(hasRow("navigation:shortcuts.items.createTask")).toBe(false);
  });

  it("clears the search on the first Escape and closes on the second", async () => {
    useShortcutsPanelStore.setState({ open: true });
    renderPanel();
    const input = await screen.findByLabelText(
      "navigation:shortcuts.searchPlaceholder",
    );
    fireEvent.change(input, { target: { value: "inbox" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await act(async () => {});
    expect(search()).toHaveValue("");
    expect(useShortcutsPanelStore.getState().open).toBe(true);

    fireEvent.keyDown(search(), { key: "Escape" });
    await act(async () => {});
    expect(useShortcutsPanelStore.getState().open).toBe(false);
  });

  it("is a non-modal dialog that opens with focus in the search and closes on an outside press", async () => {
    useShortcutsPanelStore.setState({ open: true });
    render(
      <ShortcutTestWrapper>
        <button type="button">Page button</button>
        <ShortcutsPanel />
      </ShortcutTestWrapper>,
    );
    const input = await screen.findByLabelText(
      "navigation:shortcuts.searchPlaceholder",
    );
    await waitFor(() => expect(input).toHaveFocus());

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-shortcuts", "allow");
    // Non-modal: the page stays reachable, and a press outside closes it.
    const pageButton = screen.getByRole("button", { name: "Page button" });
    expect(pageButton).toBeEnabled();
    fireEvent.pointerDown(pageButton);
    fireEvent.pointerUp(pageButton);
    fireEvent.click(pageButton);
    await waitFor(() =>
      expect(useShortcutsPanelStore.getState().open).toBe(false),
    );
  });

  it("closes from the close button and clears the query", async () => {
    useShortcutsPanelStore.setState({ open: true });
    renderPanel();
    fireEvent.change(
      await screen.findByLabelText("navigation:shortcuts.searchPlaceholder"),
      {
        target: { value: "inbox" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.close" }),
    );
    await waitFor(() =>
      expect(useShortcutsPanelStore.getState().open).toBe(false),
    );

    useShortcutsPanelStore.setState({ open: true });
    expect(
      await screen.findByLabelText("navigation:shortcuts.searchPlaceholder"),
    ).toHaveValue("");
  });
});
