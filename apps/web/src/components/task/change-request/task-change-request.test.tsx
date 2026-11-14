import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { TaskChangeRequest } from "./task-change-request";

const mocks = vi.hoisted(() => ({
  task: undefined as unknown,
  detail: undefined as unknown,
  canAnswer: false,
  userId: "neha",
  mutate: vi.fn(),
  reset: vi.fn(),
  decide: {} as Record<string, unknown>,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: mocks.userId } }),
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: mocks.task }),
}));
vi.mock("@/hooks/queries/task-change-request/use-get-change-request", () => ({
  useGetChangeRequest: () => ({ data: mocks.detail }),
}));
vi.mock(
  "@/hooks/queries/task-change-request/use-can-answer-change-request",
  () => ({ useCanAnswerChangeRequest: () => ({ data: mocks.canAnswer }) }),
);
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [{ slug: "done", isFinal: true }] }),
}));
vi.mock("@/hooks/queries/board/use-board-member-name", () => ({
  useBoardMemberName: () => (id: string) => (id === "rohan" ? "Rohan" : null),
}));
vi.mock(
  "@/hooks/mutations/task-change-request/use-decide-change-request",
  () => ({
    useDecideChangeRequest: () => ({
      mutate: mocks.mutate,
      reset: mocks.reset,
      ...mocks.decide,
    }),
  }),
);

const summary = {
  id: "r1",
  kind: "status",
  targetStatus: "done",
  requestedBy: "rohan",
  channel: "agent",
  expiresAt: new Date(Date.now() + 20 * 3_600_000).toISOString(),
};
const detail = {
  ...summary,
  baseStatus: "in-progress",
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  state: "pending",
};

beforeEach(() => {
  mocks.task = { id: "t1", pendingRequest: summary };
  mocks.detail = detail;
  mocks.canAnswer = true;
  mocks.userId = "neha";
  mocks.decide = { status: "idle" };
  mocks.mutate.mockReset();
});
afterEach(cleanup);

function renderHost() {
  render(<TaskChangeRequest projectId="p" taskId="t1" workspaceId="w" />);
}

describe("TaskChangeRequest", () => {
  it("renders nothing when the task has no pending request", () => {
    mocks.task = { id: "t1", pendingRequest: null };
    renderHost();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sends the decision for the pending request", () => {
    renderHost();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:changeRequest.accept" }),
    );
    expect(mocks.mutate).toHaveBeenCalledWith({ id: "r1", decision: "accept" });
  });

  it("shows the outcome when the server answers 409 and the request reads as decided", () => {
    mocks.decide = {
      status: "error",
      variables: { id: "r1", decision: "accept" },
      error: new HttpError(409, "decided"),
    };
    mocks.detail = { ...detail, state: "rejected" };
    renderHost();
    expect(
      screen.getByText("tasks:changeRequest.closed.rejected"),
    ).toBeTruthy();
  });

  it("keeps showing the outcome after accepting, when the task no longer has a pending request", () => {
    mocks.task = { id: "t1", pendingRequest: null };
    mocks.decide = {
      status: "success",
      variables: { id: "r1", decision: "accept" },
      data: { request: { state: "accepted" } },
    };
    renderHost();
    expect(
      screen.getByText("tasks:changeRequest.closed.accepted"),
    ).toBeTruthy();
  });

  it("lets the requester cancel and nobody else's buttons show", () => {
    mocks.userId = "rohan";
    mocks.canAnswer = true;
    renderHost();
    expect(
      screen.getByRole("button", { name: "tasks:changeRequest.cancel" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "tasks:changeRequest.accept" }),
    ).toBeNull();
  });
});
