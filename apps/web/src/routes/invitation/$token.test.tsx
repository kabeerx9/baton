import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/dashboard">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));

import { Route } from "./$token";

afterEach(() => cleanup());

describe("/invitation/<token>", () => {
  it("explains that join links replaced invitations", () => {
    const Component = (
      Route as unknown as { component: () => React.ReactElement }
    ).component;
    render(<Component />);

    expect(screen.getByText("joinLink:legacyInvite.title")).toBeTruthy();
    expect(screen.getByText("joinLink:legacyInvite.description")).toBeTruthy();
    expect(screen.getByText("joinLink:page.goToBaton")).toBeTruthy();
  });
});
