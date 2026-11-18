import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_WORKSPACE_USAGE,
  type WorkspaceUsage,
} from "@/constants/onboarding";
import useSignOut from "@/hooks/mutations/use-sign-out";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import useWorkspaceCreationAccess from "@/hooks/use-workspace-creation-access";
import { track } from "@/lib/analytics/track";
import generateProjectSlug from "@/lib/generate-project-id";
import {
  createStarterProject,
  FALLBACK_PROJECT_SLUG,
} from "@/lib/onboarding/create-starter-project";
import { starterTasks } from "@/lib/onboarding/starter-tasks";
import { toast } from "@/lib/toast";
import { OnboardingShell } from "./onboarding-shell";
import {
  getNextStep,
  getStepProgress,
  type OnboardingStepId,
} from "./onboarding-steps";
import { WorkspacePreview } from "./preview/workspace-preview";
import { ProjectStep } from "./project-step";
import { ReadyStep } from "./ready-step";
import { StartStep } from "./start-step";
import { UsageStep } from "./usage-step";
import { WorkspaceStep } from "./workspace-step";
import { workspaceWriteErrorMessage } from "@/lib/workspace-write-error-message";

type CreatedWorkspace = { workspaceId: string };

export function OnboardingFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { mutateAsync: createWorkspace } = useCreateWorkspace();
  const { isCreationRestricted, isDecided: isAccessDecided } =
    useWorkspaceCreationAccess();
  const { isPending: isConfigPending } = useGetConfig();
  const { mutateAsync: signOut } = useSignOut();
  const isDecided = isAccessDecided && !isConfigPending;

  const [step, setStep] = useState<OnboardingStepId>("start");
  const [workspaceName, setWorkspaceName] = useState("");
  const [usage, setUsage] = useState<WorkspaceUsage>(DEFAULT_WORKSPACE_USAGE);
  const [projectName, setProjectName] = useState(() =>
    t("auth:onboarding.projectNameDefault"),
  );
  const [created, setCreated] = useState<CreatedWorkspace | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [opening, setOpening] = useState(false);

  const name = workspaceName.trim();
  const projectKey = generateProjectSlug(projectName) || FALLBACK_PROJECT_SLUG;
  const reachedProject = step === "project" || step === "ready";
  const tasks = useMemo(
    () =>
      starterTasks(t, usage).map((task, position) => ({
        id: `task-${position}`,
        ticket: `${projectKey}-${position + 1}`,
        title: task.title,
      })),
    [t, usage, projectKey],
  );

  const goToWorkspace = useCallback(() => {
    if (!created) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: created.workspaceId },
      replace: true,
    });
  }, [created, navigate]);

  const createWorkspaceAndProject = async () => {
    setIsCreating(true);
    try {
      const workspace = await createWorkspace({
        name,
      });
      track("Workspace Created", { props: { usage } });
      await createStarterProject({
        workspaceId: workspace.id,
        name: projectName.trim(),
        tasks: starterTasks(t, usage),
      }).catch(() => null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      setCreated({ workspaceId: workspace.id });
      setStep(getNextStep("project"));
    } catch (error) {
      toast.error(
        workspaceWriteErrorMessage(
          error,
          t("auth:onboarding.toast.createFailed"),
        ),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error(
        workspaceWriteErrorMessage(
          error,
          t("navigation:userMenu.signOutFailed"),
        ),
      );
    }
  };

  if (step === "start" && !isDecided) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  const stepContent = () => {
    switch (step) {
      case "start":
        return (
          <StartStep
            canCreate={!isCreationRestricted}
            onCreate={() => setStep("workspace")}
            onJoin={(token) =>
              navigate({ to: "/join/$token", params: { token } })
            }
          />
        );
      case "workspace":
        return (
          <WorkspaceStep
            value={workspaceName}
            onChange={setWorkspaceName}
            onContinue={() => setStep("usage")}
          />
        );
      case "usage":
        return (
          <UsageStep
            value={usage}
            onChange={setUsage}
            onContinue={() => setStep("project")}
          />
        );
      case "project":
        return (
          <ProjectStep
            value={projectName}
            projectKey={projectKey}
            isSubmitting={isCreating}
            onChange={setProjectName}
            onContinue={createWorkspaceAndProject}
          />
        );
      default:
        return (
          <ReadyStep
            workspaceName={name}
            projectName={projectName.trim()}
            taskCount={tasks.length}
            opening={opening}
            onOpen={() => setOpening(true)}
          />
        );
    }
  };

  const startHeading = isCreationRestricted
    ? {
        title: t("auth:onboarding.restrictedTitle"),
        description: t("auth:onboarding.restrictedSubtitle"),
      }
    : {
        title: t("joinLink:onboarding.title"),
        description: t("joinLink:onboarding.description"),
      };
  const headings: Record<
    OnboardingStepId,
    { title: string; description?: string }
  > = {
    start: startHeading,
    workspace: {
      title: t("auth:onboarding.workspace.title"),
      description: t("auth:onboarding.workspace.description"),
    },
    usage: {
      title: t("auth:onboarding.usage.title"),
      description: t("auth:onboarding.usage.description", { name }),
    },
    project: {
      title: t("auth:onboarding.project.title"),
      description: t("auth:onboarding.project.description"),
    },
    ready: {
      title: t("auth:onboarding.ready.title", { name }),
      description: t("auth:onboarding.ready.description"),
    },
  };
  const heading = headings[step];
  const progress = getStepProgress(step);

  return (
    <OnboardingShell
      stepKey={step}
      progress={progress}
      title={heading.title}
      description={heading.description}
      email={user?.email}
      opening={opening}
      onOpened={goToWorkspace}
      onSignOut={handleSignOut}
      preview={
        <WorkspacePreview
          workspaceName={name || t("auth:onboarding.preview.untitled")}
          projectName={reachedProject ? projectName.trim() || null : null}
          tasks={reachedProject ? tasks : null}
        />
      }
    >
      {stepContent()}
    </OnboardingShell>
  );
}
