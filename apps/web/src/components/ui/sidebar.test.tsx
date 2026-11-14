import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Sidebar,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./sidebar";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

const cookieSet = vi.fn(async (_: unknown) => {});

beforeEach(() => {
  mobile.value = false;
  cookieSet.mockClear();
  vi.stubGlobal("cookieStore", { set: cookieSet });
});

function Layout({ onTriggerClick }: { onTriggerClick?: () => void }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive>Inbox</SidebarMenuButton>
            <SidebarMenuAction showOnHover>More</SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarRail />
      </Sidebar>
      <SidebarTrigger onClick={onTriggerClick} />
    </SidebarProvider>
  );
}

function sidebarState() {
  return document.querySelector<HTMLElement>(
    '[data-slot="sidebar"][data-state]',
  );
}

describe("Sidebar", () => {
  it("starts expanded and collapses from the trigger, then expands again", async () => {
    const onTriggerClick = vi.fn();
    render(<Layout onTriggerClick={onTriggerClick} />);
    expect(sidebarState()).toHaveAttribute("data-state", "expanded");

    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="sidebar-trigger"]')!);
    });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(sidebarState()).toHaveAttribute("data-state", "collapsed");
    expect(sidebarState()).toHaveAttribute("data-collapsible", "icon");
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "sidebar_state", value: "false" }),
    );

    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="sidebar-trigger"]')!);
    });
    expect(sidebarState()).toHaveAttribute("data-state", "expanded");
    expect(cookieSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "true" }),
    );
  });

  it("collapses from the rail", async () => {
    render(<Layout />);
    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="sidebar-rail"]')!);
    });
    expect(sidebarState()).toHaveAttribute("data-state", "collapsed");
  });

  it("opens the mobile sidebar as a dialog from the trigger and closes it with Escape", async () => {
    mobile.value = true;
    render(<Layout />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="sidebar-trigger"]')!);
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Inbox");
    // The mobile trigger never touches the desktop cookie state.
    expect(cookieSet).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    // The popup stays mounted for its exit animation but is marked closed.
    expect(dialog).toHaveAttribute("data-closed");
  });
});

describe("Sidebar parts", () => {
  it("marks the menu button and merges a render element", () => {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive render={<a href="/inbox" />} size="lg">
              Inbox
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const link = screen.getByRole("link", { name: "Inbox" });
    expect(link).toHaveAttribute("data-slot", "sidebar-menu-button");
    expect(link).toHaveAttribute("data-active", "true");
    expect(link).toHaveAttribute("data-size", "lg");
    expect(link).toHaveAttribute("data-sidebar", "menu-button");
  });

  it("renders a native button by default and runs the caller onClick", () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <SidebarMenuButton onClick={onClick}>Press</SidebarMenuButton>
      </SidebarProvider>,
    );
    const button = screen.getByRole("button", { name: "Press" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wraps the menu button in a tooltip trigger when a tooltip is given", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton tooltip="Inbox tip">Inbox</SidebarMenuButton>
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Inbox" })).toHaveAttribute(
      "data-slot",
      "sidebar-menu-button",
    );
  });

  it("renders group label, group action and sub button parts with their slots", () => {
    render(
      <SidebarProvider>
        <SidebarGroupLabel>Group</SidebarGroupLabel>
        <SidebarGroupAction>Add</SidebarGroupAction>
        <SidebarMenuSubButton href="/sub">Sub</SidebarMenuSubButton>
      </SidebarProvider>,
    );
    expect(screen.getByText("Group")).toHaveAttribute(
      "data-slot",
      "sidebar-group-label",
    );
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "data-slot",
      "sidebar-group-action",
    );
    expect(screen.getByRole("link", { name: "Sub" })).toHaveAttribute(
      "data-slot",
      "sidebar-menu-sub-button",
    );
  });

  it("styles an open menu trigger with data-popup-open and data-open", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton>Item</SidebarMenuButton>
        <SidebarMenuAction showOnHover>Act</SidebarMenuAction>
      </SidebarProvider>,
    );
    const item = screen.getByRole("button", { name: "Item" }).className;
    const action = screen.getByRole("button", { name: "Act" }).className;
    expect(item).toContain("data-popup-open:hover:bg-sidebar-accent");
    expect(item).toContain("data-open:hover:bg-sidebar-accent");
    expect(action).toContain("data-popup-open:opacity-100");
    expect(action).toContain("data-open:opacity-100");
  });
});
