import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthDetails } from "@/components/auth/auth-details";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { AuthPage } from "@/components/auth/auth-page";
import { useSettledSession } from "@/components/auth/use-settled-session";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMcpAuthorizationDecision } from "@/hooks/mutations/mcp/use-authorization-decision";
import { useMcpAuthorizationRequest } from "@/hooks/queries/mcp/use-authorization-request";
import { useConsentWorkspaces } from "@/hooks/queries/mcp/use-consent-workspaces";

const authorizationSearchSchema = z.object({
  request_id: z.string().optional(),
});

export const Route = createFileRoute("/mcp/authorize")({
  component: McpAuthorizePage,
  validateSearch: authorizationSearchSchema,
});

function McpAuthorizePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/mcp/authorize" });
  const requestId = search.request_id ?? "";
  const request = useMcpAuthorizationRequest(requestId);
  const decision = useMcpAuthorizationDecision();
  const { session, isLoading: isSessionPending } = useSettledSession();
  const workspaces = useConsentWorkspaces(Boolean(session?.user));
  const [pickedWorkspaceId, setPickedWorkspaceId] = useState<string>();
  const pageTitle = <PageTitle title={t("auth:mcp.authorize.title")} />;

  if (!requestId || request.isError) {
    return (
      <>
        {pageTitle}
        <AuthPage
          title={t("auth:mcp.expired.title")}
          description={t("auth:mcp.expired.description")}
        />
      </>
    );
  }

  if (request.isLoading || isSessionPending || workspaces.isLoading) {
    return (
      <>
        {pageTitle}
        <AuthPage title={t("auth:mcp.authorize.title")}>
          <AuthFormSkeleton />
        </AuthPage>
      </>
    );
  }

  if (!session?.user) {
    return (
      <>
        {pageTitle}
        <AuthPage
          title={t("auth:mcp.signIn.title")}
          description={t("auth:mcp.signIn.description")}
        >
          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              void navigate({
                to: "/auth/sign-in",
                search: {
                  redirect: `/mcp/authorize?request_id=${encodeURIComponent(requestId)}`,
                },
              })
            }
          >
            {t("auth:mcp.signIn.submit")}
          </Button>
        </AuthPage>
      </>
    );
  }

  // With one workspace the server picks it; with several, the person chooses.
  const choices = workspaces.data ?? [];
  const workspaceId =
    choices.length > 1 ? (pickedWorkspaceId ?? choices[0]?.id) : undefined;
  const pickedName = choices.find((choice) => choice.id === workspaceId)?.name;

  const submitDecision = (approved: boolean) => {
    decision.mutate(
      { requestId, approved, workspaceId: approved ? workspaceId : undefined },
      { onSuccess: (redirect) => window.location.assign(redirect) },
    );
  };

  return (
    <>
      {pageTitle}
      <AuthPage
        title={t("auth:mcp.authorize.title")}
        description={t("auth:mcp.authorize.description")}
      >
        <div className="flex flex-col gap-4">
          <AuthDetails
            rows={[
              {
                label: t("auth:mcp.authorize.client"),
                value: (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">
                      {request.data?.clientName ||
                        t("auth:mcp.authorize.unknownClient")}
                    </span>
                    <Badge variant="outline">
                      {t("auth:mcp.authorize.selfReported")}
                    </Badge>
                  </span>
                ),
              },
              {
                label: t("auth:mcp.authorize.redirect"),
                value: request.data?.redirectUri,
                mono: true,
              },
              {
                label: t("auth:mcp.authorize.signedInAs"),
                value: session.user.email,
              },
            ]}
          />
          {choices.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">
                {t("auth:mcp.authorize.workspace")}
              </span>
              <Select
                value={workspaceId}
                onValueChange={(value) => {
                  if (typeof value === "string") setPickedWorkspaceId(value);
                }}
                disabled={decision.isPending}
              >
                <SelectTrigger aria-label={t("auth:mcp.authorize.workspace")}>
                  <SelectValue>{pickedName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t("auth:mcp.authorize.workspaceHint")}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              loading={decision.isPending && !decision.variables?.approved}
              disabled={decision.isPending}
              onClick={() => submitDecision(false)}
            >
              {t("auth:mcp.authorize.deny")}
            </Button>
            <Button
              size="lg"
              loading={decision.isPending && decision.variables?.approved}
              disabled={decision.isPending}
              onClick={() => submitDecision(true)}
            >
              {t("auth:mcp.authorize.allow")}
            </Button>
          </div>
        </div>
      </AuthPage>
    </>
  );
}
