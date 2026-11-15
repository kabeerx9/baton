import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

// J0 smoke test: UI SDK popups open in jsdom with the stubs in setup.ts, under
// strict mode. vitest.config.ts loads no React Compiler, so this test does not
// cover it; compiler compatibility was checked in the J0 browser spike.
describe("UI SDK in jsdom", () => {
  it("opens a Dialog, moves focus into it and returns focus on close", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Share link</DialogTitle>
          <DialogClose>Done</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open dialog" });

    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Share link" });
    expect(dialog).toBeVisible();
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens a Menu, focuses an item and closes with Escape", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem value="rename">Rename</MenuItem>
          <MenuItem value="duplicate">Duplicate</MenuItem>
        </MenuContent>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });

    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Rename",
      "Duplicate",
    ]);
    await waitFor(() =>
      expect(menu.contains(document.activeElement)).toBe(true),
    );

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
    expect(trigger).toHaveFocus();
  });

  it("shows a Tooltip on keyboard focus and hides it on Escape", async () => {
    render(
      <Tooltip>
        <TooltipTrigger>Bookmark</TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Bookmark" });

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => trigger.focus());
    expect(trigger).toHaveFocus();
    const tip = await screen.findByRole("tooltip", { name: "Add to library" });
    await waitFor(() => expect(tip).not.toHaveAttribute("data-closed"));
    expect(tip).toHaveAttribute("data-open");

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(tip).toHaveAttribute("data-closed"));
    expect(trigger).toHaveFocus();
  });
});
