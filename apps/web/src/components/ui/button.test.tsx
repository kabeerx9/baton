import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Button } from "./button";

async function renderWithRouter(ui: React.ReactElement) {
  const rootRoute = createRootRoute({ component: () => ui });
  const target = createRoute({
    component: () => <p>Target page</p>,
    getParentRoute: () => rootRoute,
    path: "/target",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([target]),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  return router;
}

describe("Button parity (passes on the Base UI wrapper)", () => {
  it("renders a native button with type=button and runs onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a caller-provided type", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("submits and resets a form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input defaultValue="a" name="field" />
        <Button type="submit">Go</Button>
        <Button>Plain</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plain" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not run onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Off" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the loading state: disabled, busy marker and a spinner", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Saving/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("data-loading");
    expect(
      button.querySelector('[data-slot="button-loading-indicator"]'),
    ).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no loading marker or spinner when idle", () => {
    render(<Button>Idle</Button>);
    const button = screen.getByRole("button", { name: "Idle" });
    expect(button).not.toHaveAttribute("data-loading");
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(
      button.querySelector('[data-slot="button-loading-indicator"]'),
    ).toBeNull();
  });

  it("renders a non-button element without a type attribute", () => {
    render(<Button render={<a href="/somewhere" />}>Go</Button>);
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveAttribute("data-slot", "button");
  });

  it("accepts a render function and merges className", () => {
    render(
      <Button
        className="extra"
        render={(props) => <span {...props} data-testid="custom" />}
      >
        Fn
      </Button>,
    );
    const el = screen.getByTestId("custom");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("extra");
    expect(el).toHaveTextContent("Fn");
  });

  it("merges a ref", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Ref" }));
  });

  it("navigates when rendered as a router Link", async () => {
    const router = await renderWithRouter(
      <Button render={<Link to="/target" />}>Open</Button>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Open" }));
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/target");
  });

  it("does not navigate when a router Link button is disabled", async () => {
    const router = await renderWithRouter(
      <Button disabled render={<Link to="/target" />}>
        Blocked
      </Button>,
    );
    fireEvent.click(screen.getByText("Blocked"));
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/");
  });

  it("does not navigate when a router Link button is loading", async () => {
    const router = await renderWithRouter(
      <Button loading render={<Link to="/target" />}>
        Busy
      </Button>,
    );
    fireEvent.click(screen.getByText("Busy"));
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("Button added behavior (UI SDK port only)", () => {
  it("blocks the default action of a disabled plain link", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} render={<a href="/somewhere" />}>
        Off
      </Button>,
    );
    const link = screen.getByText("Off");
    expect(link).toHaveAttribute("aria-disabled", "true");
    // fireEvent returns false when the click's default action was prevented.
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
