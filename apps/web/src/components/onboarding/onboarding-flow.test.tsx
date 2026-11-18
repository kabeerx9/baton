import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { OnboardingFlow } from "./onboarding-flow";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  createWorkspace: vi.fn(),
  createStarterProject: vi.fn(),
  config: vi.fn(),
  authUser: vi.fn(),
  getCurrentUser: vi.fn(),
  signOut: vi.fn(),
  useSignOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => m.navigate,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => m.config(),
}));
vi.mock("@/hooks/mutations/use-sign-out", () => ({
  default: () => m.useSignOut(),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: m.toastError, success: vi.fn() },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: () => m.signOut(),
  },
}));
vi.mock("@/fetchers/user/get-current-user", () => ({
  getCurrentUser: () => m.getCurrentUser(),
}));
vi.mock("@/hooks/queries/user/use-current-user", () => ({
  useCurrentUser: () => ({ data: m.authUser() }),
}));
vi.mock("@/hooks/queries/workspace/use-create-workspace", () => ({
  default: () => ({ mutateAsync: m.createWorkspace, isPending: false }),
}));
vi.mock("@/lib/onboarding/create-starter-project", () => ({
  FALLBACK_PROJECT_SLUG: "PRJ",
  createStarterProject: (input: unknown) => m.createStarterProject(input),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: m.authUser(), refetchUser: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  m.createWorkspace.mockResolvedValue({ id: "workspace-1" });
  m.createStarterProject.mockResolvedValue("project-1");
  m.authUser.mockReturnValue({
    id: "u1",
    name: "Sam Lee",
    email: "sam@example.com",
    role: "user",
  });
  m.getCurrentUser.mockResolvedValue({ id: "u1", role: "user" });
  m.config.mockReturnValue({
    data: { disableWorkspaceCreation: false },
    isPending: false,
  });
  m.signOut.mockResolvedValue({});
  m.useSignOut.mockReturnValue({ mutateAsync: m.signOut });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

function render(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrap = (node: ReactNode) =>
    createElement(QueryClientProvider, { client }, node) as never;
  const result = rtlRender(wrap(ui));
  return {
    ...result,
    rerender: (next: ReactNode) => result.rerender(wrap(next)),
  };
}

const settled = () => act(async () => {});
const continueButton = () =>
  screen.getByRole("button", { name: "auth:onboarding.continue" });
const startButton = () =>
  screen.getByRole("button", { name: "joinLink:onboarding.join.continue" });
const chooseCreate = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "joinLink:onboarding.create.title" }),
  );
const startStep = () => screen.queryByText("joinLink:onboarding.title");
const restricted = () => screen.queryByText("auth:onboarding.restrictedTitle");
const createOption = () =>
  screen.queryByRole("button", { name: "joinLink:onboarding.create.title" });
const TOKEN = "Ab3_-Zx9".repeat(5) + "Abc";

async function toCreationStep() {
  render(<OnboardingFlow />);
  await settled();
  chooseCreate();
  await screen.findByText("auth:onboarding.workspace.title");
}

const toWorkspace = {
  to: "/dashboard/workspace/$workspaceId",
  params: { workspaceId: "workspace-1" },
  replace: true,
};

async function walkToProject({
  usage = "team",
}: { usage?: "solo" | "team" } = {}) {
  await toCreationStep();
  fireEvent.change(screen.getByLabelText("auth:onboarding.workspaceName"), {
    target: { value: "Acme" },
  });
  fireEvent.click(continueButton());
  await screen.findByText("auth:onboarding.usage.title");
  if (usage === "solo") {
    fireEvent.click(screen.getByLabelText(/auth:onboarding.cloud.usageSolo/));
  }
  fireEvent.click(continueButton());
  await screen.findByText("auth:onboarding.project.title");
}

async function createWorkspace(options?: Parameters<typeof walkToProject>[0]) {
  await walkToProject(options);
  fireEvent.click(continueButton());
  await settled();
}

describe("OnboardingFlow steps", () => {
  it("builds the preview from the answers before anything is created", async () => {
    await walkToProject();
    fireEvent.change(screen.getByLabelText("auth:onboarding.project.label"), {
      target: { value: "Website relaunch" },
    });

    expect(screen.getAllByText("Acme").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Website relaunch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WR-1").length).toBeGreaterThan(0);
    expect(m.createWorkspace).not.toHaveBeenCalled();
  });

  it("asks for a workspace name before moving on", async () => {
    await toCreationStep();
    fireEvent.click(continueButton());

    expect(
      screen.getByText("auth:onboarding.validation.workspaceNameRequired"),
    ).toBeInTheDocument();
    expect(screen.queryByText("auth:onboarding.usage.title")).toBeNull();
  });

  it("creates the workspace and starter project once, then opens the workspace from Ready", async () => {
    await createWorkspace();

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(m.createWorkspace).toHaveBeenCalledTimes(1);
    expect(m.createWorkspace).toHaveBeenCalledWith({ name: "Acme" });
    expect(m.createStarterProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        name: "auth:onboarding.projectNameDefault",
      }),
    );
    expect(m.navigate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.ready.open" }),
    );
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(toWorkspace));
  });

  it("stays on the project step and keeps the answers when creation fails", async () => {
    m.createWorkspace.mockRejectedValueOnce(new Error("slug taken"));
    await createWorkspace();

    expect(
      screen.getByText("auth:onboarding.project.title"),
    ).toBeInTheDocument();
    expect(m.createStarterProject).not.toHaveBeenCalled();
  });

  it("signs out from the footer", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.signOut" }),
    );

    await waitFor(() => expect(m.signOut).toHaveBeenCalledTimes(1));
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("stays on onboarding and reports a failed sign-out", async () => {
    m.signOut.mockRejectedValueOnce(new Error("Could not sign out"));
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.signOut" }),
    );

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith("Could not sign out"),
    );
    expect(m.navigate).not.toHaveBeenCalled();
    expect(startStep()).toBeInTheDocument();
  });
});

describe("OnboardingFlow join with a link", () => {
  const field = () => screen.getByLabelText("joinLink:onboarding.join.label");

  it("opens the join page for a pasted URL", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.change(field(), {
      target: { value: `https://baton.example/join/${TOKEN}` },
    });
    fireEvent.click(startButton());

    expect(m.navigate).toHaveBeenCalledWith({
      to: "/join/$token",
      params: { token: TOKEN },
    });
  });

  it("opens the join page for a raw token", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.change(field(), { target: { value: TOKEN } });
    fireEvent.click(startButton());

    expect(m.navigate).toHaveBeenCalledWith({
      to: "/join/$token",
      params: { token: TOKEN },
    });
  });

  it("shows an error and stays put for input that is not a join link", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.change(field(), { target: { value: "hello" } });
    fireEvent.click(startButton());

    expect(
      screen.getByText("joinLink:onboarding.join.invalid"),
    ).toBeInTheDocument();
    expect(m.navigate).not.toHaveBeenCalled();
  });
});

describe("OnboardingFlow access", () => {
  it("offers both choices when anyone may create a workspace", async () => {
    render(<OnboardingFlow />);
    await settled();

    expect(startStep()).toBeInTheDocument();
    expect(createOption()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("explains the restriction instead of offering a flow that would fail", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    render(<OnboardingFlow />);
    await settled();

    expect(restricted()).toBeInTheDocument();
    expect(createOption()).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("joinLink:onboarding.join.label"),
    ).toBeInTheDocument();
  });

  it("still offers the flow to an instance admin when creation is restricted", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    m.getCurrentUser.mockResolvedValue({ id: "u1", role: "admin" });
    render(<OnboardingFlow />);
    await settled();

    expect(createOption()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("shows progress while the decision is pending", async () => {
    m.config.mockReturnValue({ data: undefined, isPending: true });
    render(<OnboardingFlow />);
    await settled();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(startStep()).not.toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("falls back to the flow when the config request fails", async () => {
    m.config.mockReturnValue({ data: undefined, isPending: false });
    render(<OnboardingFlow />);
    await settled();

    expect(createOption()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("offers the flow when the role refresh fails under a restriction", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    m.getCurrentUser.mockRejectedValue(new Error("network"));
    render(<OnboardingFlow />);
    await settled();
    await settled();

    expect(createOption()).toBeInTheDocument();
  });

  it("re-reads the role from the API, once", async () => {
    const { rerender } = render(<OnboardingFlow />);
    await settled();
    expect(m.getCurrentUser).toHaveBeenCalledTimes(1);

    m.getCurrentUser.mockClear();
    rerender(<OnboardingFlow />);
    await settled();
    expect(m.getCurrentUser).not.toHaveBeenCalled();
  });

  it("does not bring the first step back if config recovers after creation", async () => {
    await createWorkspace();
    m.config.mockReturnValue({
      data: { isCloud: false, disableWorkspaceCreation: true },
      isPending: false,
    });
    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(startStep()).toBeNull();
  });
});
