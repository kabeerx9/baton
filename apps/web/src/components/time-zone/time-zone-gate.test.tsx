import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { TimeZoneGate } from "./time-zone-gate";

// Keys are enough to see which copy shows; options show which zones it names.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

const route = vi.hoisted(() => ({ pathname: "/dashboard/acme" }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: route.pathname }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));

const tour = vi.hoisted(() => ({ completed: true as boolean | undefined }));
vi.mock("@/hooks/queries/tour/use-tour-status", () => ({
  useTourStatus: () => ({ data: { completed: tour.completed } }),
}));

const detect = vi.hoisted(() => vi.fn());
vi.mock("@/lib/time-zone/detect-time-zone", () => ({ detectTimeZone: detect }));

const toastApi = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: toastApi }));

const getCurrentUser = vi.hoisted(() => vi.fn());
const setTimeZone = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/user/get-current-user", () => ({ getCurrentUser }));
vi.mock("@/fetchers/user/set-time-zone", () => ({ setTimeZone }));

const account = (timeZone: string | null) => ({
  id: "user-1",
  name: "Jane",
  email: "jane@example.com",
  image: null,
  role: null,
  timeZone,
});

function renderGate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TimeZoneGate />, { wrapper });
}

beforeEach(() => {
  route.pathname = "/dashboard/acme";
  tour.completed = true;
  detect.mockReturnValue("Asia/Kolkata");
  getCurrentUser.mockResolvedValue(account(null));
  setTimeZone.mockImplementation(async (timeZone: string) => ({ timeZone }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("TimeZoneGate", () => {
  it("stays hidden while the tour is owed", async () => {
    tour.completed = false;
    renderGate();
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("stays hidden when the stored zone matches the device", async () => {
    getCurrentUser.mockResolvedValue(account("Asia/Calcutta"));
    renderGate();
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("unset: Confirm sends the detected zone and hides the card", async () => {
    renderGate();
    fireEvent.click(await screen.findByText("prompt.unset.confirm"));
    await waitFor(() =>
      expect(setTimeZone.mock.calls[0]?.[0]).toBe("Asia/Kolkata"),
    );
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
    expect(toastApi.success).toHaveBeenCalledWith("prompt.saved");
  });

  it("unset: Close hides it for this session only", async () => {
    renderGate();
    fireEvent.click(await screen.findByLabelText("prompt.dismiss"));
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
    expect(window.sessionStorage.getItem("baton:time-zone-prompt:user-1")).toBe(
      "Asia/Kolkata",
    );
    expect(
      window.localStorage.getItem("baton:time-zone-prompt:user-1"),
    ).toBeNull();
    cleanup();
    renderGate();
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("unset: a new visit asks again", async () => {
    window.sessionStorage.clear();
    renderGate();
    expect(await screen.findByText("prompt.unset.confirm")).toBeTruthy();
  });

  it("mismatch: shows both zones and Keep remembers the choice in the browser", async () => {
    getCurrentUser.mockResolvedValue(account("Europe/London"));
    renderGate();
    expect(
      await screen.findByText(/prompt\.mismatch\.title.*Asia\/Kolkata/),
    ).toBeTruthy();
    expect(
      screen.getByText(/prompt\.mismatch\.body.*Europe\/London/),
    ).toBeTruthy();
    fireEvent.click(screen.getByText(/prompt\.mismatch\.keep.*Europe\/London/));
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
    expect(window.localStorage.getItem("baton:time-zone-prompt:user-1")).toBe(
      "Asia/Kolkata",
    );
  });

  it("mismatch: asks once more for a new device zone", async () => {
    getCurrentUser.mockResolvedValue(account("Europe/London"));
    window.localStorage.setItem("baton:time-zone-prompt:user-1", "Asia/Tokyo");
    renderGate();
    expect(await screen.findByText(/prompt\.mismatch\.title/)).toBeTruthy();
  });

  it("unset: picking the zone the card already suggests confirms it", async () => {
    detect.mockReturnValue("UTC");
    renderGate();
    fireEvent.click(await screen.findByText("prompt.change"));

    const search = await screen.findByRole("combobox");
    fireEvent.change(search, { target: { value: "UTC" } });

    const option = await screen.findByRole("option", { name: /UTC/ });
    fireEvent.click(option);

    await waitFor(() => expect(setTimeZone.mock.calls[0]?.[0]).toBe("UTC"));
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  });

  it("a failed save keeps the prompt and shows the error in it", async () => {
    setTimeZone.mockRejectedValue(new Error("boom"));
    renderGate();
    fireEvent.click(await screen.findByText("prompt.unset.confirm"));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "prompt.saveFailed",
    );
    expect(screen.getByRole("region")).toBeTruthy();
    expect(
      screen.getByText("prompt.unset.confirm").closest("button")?.disabled,
    ).toBe(false);
  });
});
