import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

function Trail() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Baton</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

describe("Breadcrumb", () => {
  it("renders a named navigation with an ordered list", () => {
    render(<Trail />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveAttribute("data-slot", "breadcrumb");

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list).toHaveAttribute("data-slot", "breadcrumb-list");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("marks the current page as a disabled link", () => {
    render(<Trail />);

    const page = screen.getByRole("link", { name: "Baton" });
    expect(page.tagName).toBe("SPAN");
    expect(page).toHaveAttribute("data-slot", "breadcrumb-page");
    expect(page).toHaveAttribute("aria-current", "page");
    expect(page).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the link and its href by default", () => {
    render(<Trail />);

    const link = screen.getByRole("link", { name: "Projects" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/projects");
    expect(link).toHaveAttribute("data-slot", "breadcrumb-link");
    expect(link.className).toContain("hover:text-foreground");
  });

  it("renders the link as a given element", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="truncate"
              render={<a href="/projects" data-router-link="" />}
            >
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    const link = screen.getByRole("link", { name: "Projects" });
    expect(link).toHaveAttribute("href", "/projects");
    expect(link).toHaveAttribute("data-router-link", "");
    expect(link).toHaveAttribute("data-slot", "breadcrumb-link");
    expect(link.className).toContain("truncate");
    expect(link.className).toContain("hover:text-foreground");
  });

  it("renders the link from a function", () => {
    const view = vi.fn((props: Record<string, unknown>) => (
      <a {...props} data-router-link="">
        {props.children as React.ReactNode}
      </a>
    ));

    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects" render={view}>
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    const link = screen.getByRole("link", { name: "Projects" });
    expect(view).toHaveBeenCalledTimes(1);
    expect(link).toHaveAttribute("href", "/projects");
    expect(link).toHaveAttribute("data-router-link", "");
    expect(link).toHaveAttribute("data-slot", "breadcrumb-link");
  });

  it("renders a decorative separator with a chevron by default", () => {
    const { container } = render(<Trail />);

    const separator = container.querySelector(
      '[data-slot="breadcrumb-separator"]',
    );
    expect(separator).not.toBeNull();
    expect(separator).toHaveAttribute("role", "presentation");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(separator?.querySelector("svg")).not.toBeNull();
  });

  it("keeps custom separator content", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    expect(screen.getByText("/")).toBeInTheDocument();
  });
});
