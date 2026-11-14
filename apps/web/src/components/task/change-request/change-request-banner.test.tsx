import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ChangeRequestBanner } from "./change-request-banner";
import type { BannerRequest, BannerState } from "./model";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

afterEach(cleanup);

const request: BannerRequest = {
  id: "r1",
  kind: "status",
  targetStatus: "done",
  baseStatus: "in-progress",
  requestedBy: "rohan",
  channel: "agent",
  createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  expiresAt: new Date(Date.now() + 21 * 3_600_000).toISOString(),
};

function open(
  role: "answer" | "cancel" | "observe",
  over: Partial<Extract<BannerState, { kind: "open" }>> = {},
): BannerState {
  return { kind: "open", role, request, sending: null, error: null, ...over };
}

function renderBanner(state: BannerState, onDecide = vi.fn()) {
  const onDismiss = vi.fn();
  render(
    <ChangeRequestBanner
      appliesOnTimeout={false}
      now={Date.now()}
      onDecide={onDecide}
      onDismiss={onDismiss}
      requesterName="Rohan"
      state={state as Exclude<BannerState, { kind: "hidden" }>}
      statusLabel={(slug) => slug}
    />,
  );
  return { onDecide, onDismiss };
}

describe("ChangeRequestBanner", () => {
  it("lets someone who can answer accept or reject", () => {
    const { onDecide } = renderBanner(open("answer"));
    expect(
      screen.getByRole("status", { name: "tasks:changeRequest.bannerLabel" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:changeRequest.accept" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:changeRequest.reject" }),
    );
    expect(onDecide).toHaveBeenNthCalledWith(1, "accept");
    expect(onDecide).toHaveBeenNthCalledWith(2, "reject");
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("names the requester once and marks an agent with one badge", () => {
    renderBanner(open("answer"));
    expect(screen.getAllByText("common:channel.agent")).toHaveLength(1);
    expect(screen.getByText(/askStatusFrom/).textContent).toContain(
      '"name":"Rohan"',
    );
    expect(screen.getByText(/askStatusFrom/).textContent).not.toContain(
      "(agent)",
    );
  });

  it("gives the requester only a cancel button", () => {
    const { onDecide } = renderBanner(open("cancel"));
    expect(
      screen.queryByRole("button", { name: "tasks:changeRequest.accept" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:changeRequest.cancel" }),
    );
    expect(onDecide).toHaveBeenCalledWith("cancel");
    expect(screen.getByText(/mineStatusFrom/)).toBeTruthy();
  });

  it("shows other people a read-only notice", () => {
    renderBanner(open("observe"));
    expect(screen.getByText(/changeRequest.observe/)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("disables both answers while one is sent", () => {
    renderBanner(open("answer", { sending: "accept" }));
    expect(
      (
        screen.getByRole("button", {
          name: "tasks:changeRequest.reject",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("says the request was already decided on a 409", () => {
    renderBanner(open("answer", { error: "decided" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "tasks:changeRequest.errorDecided",
    );
  });

  it("says a failure can be tried again and keeps the buttons", () => {
    renderBanner(open("answer", { error: "failed" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "tasks:changeRequest.errorFailed",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "tasks:changeRequest.accept",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("shows the recorded outcome and can be dismissed", () => {
    const { onDismiss } = renderBanner({
      kind: "closed",
      state: "rejected",
      request,
    });
    expect(
      screen.getByText("tasks:changeRequest.closed.rejected"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /tasks:changeRequest.dismiss/ }),
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it("treats an unknown state as closed", () => {
    renderBanner({ kind: "closed", state: "from_the_future", request: null });
    expect(screen.getByText("tasks:changeRequest.closed.unknown")).toBeTruthy();
  });
});
