import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { InShell } from "../in-shell";
import { PendingSplash } from "./pending-splash";

vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: "/dashboard/workspace/w1/board" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PendingSplash", () => {
  it("is the full splash when no app shell is mounted", () => {
    render(<PendingSplash />);
    expect(screen.getByText("common:splash.workspace")).toBeInTheDocument();
  });

  it("is a small spinner inside an app shell", () => {
    render(
      <InShell>
        <PendingSplash />
      </InShell>,
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "common:empty.loading",
    );
    expect(
      screen.queryByText("common:splash.workspace"),
    ).not.toBeInTheDocument();
  });
});
