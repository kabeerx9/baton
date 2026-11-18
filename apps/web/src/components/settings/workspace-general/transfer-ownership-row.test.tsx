import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TransferOwnershipRow } from "./transfer-ownership-row";

const m = vi.hoisted(() => ({
  transfer: vi.fn(),
  isPending: false,
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/workspace/use-transfer-workspace-ownership", () => ({
  default: () => ({ mutateAsync: m.transfer, isPending: m.isPending }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

const candidates = [{ id: "u2", name: "Bea", email: "bea@example.com" }];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.isPending = false;
});

async function pickAndConfirm() {
  fireEvent.click(
    screen.getByRole("combobox", {
      name: "settings:workspaceGeneral.transferOwnership.pickerLabel",
    }),
  );
  fireEvent.click(await screen.findByRole("option", { name: /Bea/ }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:workspaceGeneral.transferOwnership.button",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "settings:workspaceGeneral.transferOwnership.confirm",
    }),
  );
}

describe("TransferOwnershipRow", () => {
  it("transfers to the picked user id in one call", async () => {
    m.transfer.mockResolvedValue({});
    render(
      <TransferOwnershipRow
        workspaceId="w1"
        workspaceName="Acme"
        candidates={candidates}
      />,
    );
    await pickAndConfirm();
    await waitFor(() =>
      expect(m.transfer).toHaveBeenCalledWith({
        workspaceId: "w1",
        newOwnerUserId: "u2",
      }),
    );
    expect(m.transfer).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(m.success).toHaveBeenCalled());
  });

  it("shows the API's error when the transfer is refused", async () => {
    m.transfer.mockRejectedValue(new Error("Only an owner can transfer"));
    render(
      <TransferOwnershipRow
        workspaceId="w1"
        workspaceName="Acme"
        candidates={candidates}
      />,
    );
    await pickAndConfirm();
    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith("Only an owner can transfer"),
    );
    expect(m.success).not.toHaveBeenCalled();
  });
});
