import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { isPasswordSignUpEnabled } from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { InvitationNotice } from "@/components/auth/invitation-notice";
import { PasswordSignUpForm } from "@/components/auth/password-sign-up-form";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getConfig } from "@/fetchers/config/get-config";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { toast } from "@/lib/toast";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: signUpSearchSchema,
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["config"],
      queryFn: getConfig,
    }),
});

function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-up" });
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signUp.instanceStatusError"),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);

  const invitationId = search.invitationId;
  const isInstanceAdminSetup = instanceStatus?.hasUsers === false;
  const destination = invitationId
    ? `/invitation/accept/${invitationId}`
    : "/dashboard";
  const selfServiceAllowed =
    !config?.disableRegistration ||
    Boolean(invitationId) ||
    isInstanceAdminSetup;
  const passwordEnabled =
    selfServiceAllowed && isPasswordSignUpEnabled(config, isInstanceAdminSetup);

  const description = isInstanceAdminSetup
    ? t("auth:signUp.instanceAdminSubtitle")
    : passwordEnabled
      ? t("auth:signUp.subtitle.password")
      : undefined;

  const notice = invitationId ? (
    <InvitationNotice
      invitationId={invitationId}
      description={t("auth:signUp.invitation.description")}
    />
  ) : config?.disableRegistration && !isInstanceAdminSetup ? (
    <Alert role="note">
      <Info />
      <AlertDescription>
        {t("auth:signUp.registrationDisabledAlert")}
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <>
      <PageTitle title={t("auth:signUp.pageTitle")} />
      <AuthPage
        title={
          isInstanceAdminSetup
            ? t("auth:signUp.instanceAdminTitle")
            : t("auth:signUp.heading")
        }
        description={isConfigLoading ? undefined : description}
        notice={notice}
      >
        {isConfigLoading ? <AuthFormSkeleton /> : null}
        {passwordEnabled ? (
          <PasswordSignUpForm
            defaultEmail={search.email}
            invitationId={invitationId}
            onSuccess={() => navigate({ to: destination })}
          />
        ) : null}
        {!isConfigLoading && !passwordEnabled ? (
          <p className="text-muted-foreground text-sm">
            {t("auth:signIn.footer.inviteOnly")}
          </p>
        ) : null}
        {isInstanceAdminSetup ? null : (
          <div className="flex flex-col gap-2 pt-8 text-muted-foreground text-sm">
            <p>
              {t("auth:signUp.toggleMessage")}{" "}
              <Link
                to="/auth/sign-in"
                search={{ invitationId, email: search.email }}
                className={authLinkClassName}
              >
                {t("auth:signUp.toggleLink")}
              </Link>
            </p>
          </div>
        )}
      </AuthPage>
    </>
  );
}
