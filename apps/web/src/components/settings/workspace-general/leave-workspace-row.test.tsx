import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { LeaveWorkspaceRow } from "./leave-workspace-row";

const mocks = vi.hoisted(() => ({
  leaveWorkspace: vi.fn(),
  leaveGone: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

const t = vi.hoisted(
  () => (key: string, options?: { name?: string }) =>
    options?.name ? `${key}:${options.name}` : key,
);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));
vi.mock("i18next", () => ({ default: { t } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/mutations/workspace/use-leave-workspace", () => ({
  default: () => ({ mutateAsync: mocks.leaveWorkspace, isPending: false }),
}));
vi.mock("@/lib/leave-gone-workspace", () => ({
  leaveGoneWorkspace: mocks.leaveGone,
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const client = new QueryClient();
function row(props: { id?: string; name?: string; isOwner?: boolean } = {}) {
  return (
    <QueryClientProvider client={client}>
      <LeaveWorkspaceRow
        workspaceId={props.id ?? "w1"}
        workspaceName={props.name ?? "Beta"}
        isOwner={props.isOwner ?? false}
      />
    </QueryClientProvider>
  );
}

const leaveButton = () =>
  screen.getByRole("button", {
    name: "settings:workspaceGeneral.leave.button",
  });
const confirmButton = () =>
  screen.findByRole("button", {
    name: "settings:workspaceGeneral.leave.confirm",
  });

function refusal(code: string) {
  return new HttpError(409, "refused", { code });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("LeaveWorkspaceRow", () => {
  it("confirms with the workspace's name, leaves it and lands elsewhere", async () => {
    mocks.leaveWorkspace.mockResolvedValue({ workspaceId: "w1" });
    mocks.leaveGone.mockResolvedValue(undefined);
    render(row());
    fireEvent.click(leaveButton());
    expect(
      await screen.findByText(
        "settings:workspaceGeneral.leave.dialogTitle:Beta",
      ),
    ).toBeInTheDocument();
    fireEvent.click(await confirmButton());
    await waitFor(() =>
      expect(mocks.leaveGone).toHaveBeenCalledWith(
        "w1",
        expect.objectContaining({ userId: "u1" }),
      ),
    );
    expect(mocks.leaveWorkspace).toHaveBeenCalledWith({ workspaceId: "w1" });
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("leaves the workspace the dialog named, even if the active one changes", async () => {
    mocks.leaveWorkspace.mockResolvedValue({ workspaceId: "w1" });
    const view = render(row());
    fireEvent.click(leaveButton());
    view.rerender(row({ id: "other", name: "Other" }));
    fireEvent.click(await confirmButton());
    await waitFor(() =>
      expect(mocks.leaveWorkspace).toHaveBeenCalledWith({ workspaceId: "w1" }),
    );
  });

  it("tells the owner to transfer ownership first, and cannot be pressed", () => {
    render(row({ isOwner: true }));
    expect(leaveButton()).toBeDisabled();
    expect(
      screen.getByText("settings:workspaceGeneral.leave.ownerDescription:Beta"),
    ).toBeInTheDocument();
  });

  it.each([
    ["ONLY_OWNER", "settings:workspaceGeneral.leave.errorOnlyOwner"],
    ["DEMO_WORKSPACE", "settings:workspaceGeneral.leave.errorDemo"],
  ])("stays put and explains a %s refusal", async (code, copy) => {
    mocks.leaveWorkspace.mockRejectedValue(refusal(code));
    render(row());
    fireEvent.click(leaveButton());
    fireEvent.click(await confirmButton());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy));
    expect(mocks.leaveGone).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
