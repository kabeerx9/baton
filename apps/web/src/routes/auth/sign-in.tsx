import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import {
  getSafeRedirectPath,
  getSignInFooter,
} from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { PasswordSignInForm } from "@/components/auth/password-sign-in-form";
import { SignInFooterLine } from "@/components/auth/sign-in-footer-line";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { toast } from "@/lib/toast";

const signInSearchSchema = z.object({
  email: z.string().optional(),
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
  validateSearch: signInSearchSchema,
});

function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-in" });
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isLoading: isInstanceStatusLoading,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();

  const redirectPath = getSafeRedirectPath(search.redirect);
  const destination = redirectPath ?? "/dashboard";

  useEffect(() => {
    if (instanceStatus?.hasUsers === false) {
      navigate({ to: "/auth/sign-up", replace: true });
    }
  }, [instanceStatus, navigate]);

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signIn.instanceStatusError"),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);

  if (
    isConfigLoading ||
    isInstanceStatusLoading ||
    instanceStatus?.hasUsers === false
  ) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AuthPage title={t("auth:signIn.heading")}>
          <AuthFormSkeleton />
        </AuthPage>
      </>
    );
  }

  const errorMessage = search.error
    ? t(
        `auth:signIn.errors.${search.error.replace(/[._]+/g, "_").toLowerCase()}`,
        { defaultValue: search.error.replace(/_/g, " ") },
      )
    : null;

  return (
    <>
      <PageTitle title={t("auth:signIn.pageTitle")} />
      <AuthPage
        title={t("auth:signIn.heading")}
        description={t("auth:signIn.subtitle.password")}
        notice={
          errorMessage ? (
            <Alert variant="error">
              <CircleAlert />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null
        }
      >
        <PasswordSignInForm
          defaultEmail={search.email}
          canResetPassword={config?.hasSmtp}
          onSuccess={() => navigate({ to: destination })}
        />
        <div className="flex flex-col gap-2 pt-8 text-muted-foreground text-sm">
          <SignInFooterLine
            footer={getSignInFooter(config)}
            redirect={redirectPath}
            email={search.email}
          />
        </div>
      </AuthPage>
    </>
  );
}
