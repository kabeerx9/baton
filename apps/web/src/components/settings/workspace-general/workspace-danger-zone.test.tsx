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
import { WorkspaceDangerZone } from "./workspace-danger-zone";

const mocks = vi.hoisted(() => ({
  deleteWorkspace: vi.fn(),
  leave: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/mutations/workspace/use-delete-workspace", () => ({
  default: () => ({ mutateAsync: mocks.deleteWorkspace, isPending: false }),
}));
vi.mock("@/lib/leave-gone-workspace", () => ({
  leaveGoneWorkspace: mocks.leave,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: mocks.toastError },
}));

function zone(id: string, name: string) {
  return (
    <QueryClientProvider client={client}>
      <WorkspaceDangerZone workspaceId={id} workspaceName={name} />
    </QueryClientProvider>
  );
}
const client = new QueryClient();

function renderZone() {
  return render(zone("w1", "Beta"));
}

const confirmButton = () =>
  screen.findByRole("button", {
    name: "settings:workspaceGeneral.deleteModalConfirm",
  });

function openDialog() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:workspaceGeneral.deleteWorkspace",
    }),
  );
}

async function typeName(name: string) {
  fireEvent.change(
    await screen.findByLabelText(
      "settings:workspaceGeneral.deleteTypeToConfirm",
    ),
    { target: { value: name } },
  );
}

async function confirmDelete() {
  openDialog();
  await typeName("Beta");
  fireEvent.click(await confirmButton());
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("WorkspaceDangerZone", () => {
  it("leaves the deleted workspace after a successful delete", async () => {
    mocks.deleteWorkspace.mockResolvedValue({});
    mocks.leave.mockResolvedValue(undefined);
    renderZone();
    await confirmDelete();
    await waitFor(() =>
      expect(mocks.leave).toHaveBeenCalledWith("w1", expect.anything()),
    );
    expect(mocks.deleteWorkspace).toHaveBeenCalledWith({ workspaceId: "w1" });
  });

  it("keeps delete disabled until the workspace name is typed", async () => {
    renderZone();
    openDialog();
    expect(await confirmButton()).toBeDisabled();
    await typeName("Alpha");
    expect(await confirmButton()).toBeDisabled();
    await typeName("Beta");
    expect(await confirmButton()).toBeEnabled();
  });

  it("deletes the workspace the dialog named, even if the active one changes", async () => {
    mocks.deleteWorkspace.mockResolvedValue({});
    mocks.leave.mockResolvedValue(undefined);
    const view = renderZone();
    openDialog();
    await typeName("Beta");
    view.rerender(zone("other", "Other"));
    fireEvent.click(await confirmButton());
    await waitFor(() =>
      expect(mocks.deleteWorkspace).toHaveBeenCalledWith({ workspaceId: "w1" }),
    );
    expect(mocks.deleteWorkspace).not.toHaveBeenCalledWith({
      workspaceId: "other",
    });
  });

  it("stays on the page with an error when the delete fails", async () => {
    mocks.deleteWorkspace.mockRejectedValue(new Error("Forbidden"));
    renderZone();
    await confirmDelete();
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Forbidden"),
    );
    expect(mocks.leave).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
