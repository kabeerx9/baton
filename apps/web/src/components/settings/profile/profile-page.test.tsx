import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ProfilePage } from "./profile-page";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({
    user: {
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      image: "https://id.example.com/jane.png",
    },
    refetchUser: vi.fn(),
  }),
}));
vi.mock("@/hooks/mutations/use-update-user-profile", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/use-update-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/use-remove-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/components/settings/profile/delete-account-section", () => ({
  DeleteAccountSection: () => null,
}));
vi.mock("@/components/settings/profile/time-zone-section", () => ({
  TimeZoneSection: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ProfilePage", () => {
  afterEach(cleanup);

  it("keeps the name and picture editable", () => {
    render(<ProfilePage />);

    expect(
      screen.getByRole("textbox", {
        name: "settings:informationPage.fullName",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "settings:informationPage.avatar.upload",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "settings:informationPage.avatar.remove",
      }),
    ).toBeTruthy();
  });
});
