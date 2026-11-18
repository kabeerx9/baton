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
import { TimeZoneSection } from "./time-zone-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
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

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TimeZoneSection />, { wrapper });
}

beforeEach(() => {
  detect.mockReturnValue("Europe/London");
  getCurrentUser.mockResolvedValue(account("Asia/Kolkata"));
  setTimeZone.mockImplementation(async (timeZone: string) => ({ timeZone }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("TimeZoneSection", () => {
  it("shows the saved zone and a hint when the device clock differs", async () => {
    renderSection();
    expect(await screen.findByText("Asia/Kolkata")).toBeTruthy();
    expect(
      screen.getByText(/settings\.deviceHint.*Europe\/London/),
    ).toBeTruthy();
  });

  it("hides the hint when the device clock is the same", async () => {
    detect.mockReturnValue("Asia/Calcutta");
    renderSection();
    await screen.findByText("Asia/Kolkata");
    expect(screen.queryByText(/settings\.deviceHint/)).toBeNull();
  });

  it("Use device time zone saves the device zone and shows Saved", async () => {
    renderSection();
    fireEvent.click(await screen.findByText("settings.useDevice"));
    await waitFor(() =>
      expect(setTimeZone.mock.calls[0]?.[0]).toBe("Europe/London"),
    );
    expect(await screen.findByText("settings.saved")).toBeTruthy();
    expect(await screen.findByText("Europe/London")).toBeTruthy();
    expect(window.localStorage.getItem("baton:time-zone-prompt:user-1")).toBe(
      "Europe/London",
    );
  });

  it("a failed save keeps the old zone and offers Retry", async () => {
    setTimeZone.mockRejectedValueOnce(new Error("boom"));
    renderSection();
    fireEvent.click(await screen.findByText("settings.useDevice"));
    expect(
      await screen.findByText(/settings\.saveFailedFor.*Europe\/London/),
    ).toBeTruthy();
    expect(screen.getByText("Asia/Kolkata")).toBeTruthy();
    fireEvent.click(screen.getByText("settings.retry"));
    expect(await screen.findByText("settings.saved")).toBeTruthy();
  });

  it("Change opens the picker and a pick saves", async () => {
    renderSection();
    fireEvent.click(await screen.findByText("settings.change"));
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "Tokyo" } });
    fireEvent.click(await screen.findByRole("option", { name: /Asia\/Tokyo/ }));
    await waitFor(() =>
      expect(setTimeZone.mock.calls[0]?.[0]).toBe("Asia/Tokyo"),
    );
  });
});
