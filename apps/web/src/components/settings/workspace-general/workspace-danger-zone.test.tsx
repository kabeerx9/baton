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

function renderZone() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceDangerZone workspaceId="w1" workspaceName="Beta" />
    </QueryClientProvider>,
  );
}

async function confirmDelete() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:workspaceGeneral.deleteWorkspace",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "settings:workspaceGeneral.deleteModalConfirm",
    }),
  );
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
