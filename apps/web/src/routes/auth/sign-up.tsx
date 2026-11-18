import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import {
  getSafeRedirectPath,
  isPasswordSignUpEnabled,
} from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { PasswordSignUpForm } from "@/components/auth/password-sign-up-form";
import { RegistrationClosed } from "@/components/auth/registration-closed";
import PageTitle from "@/components/page-title";
import { getConfig } from "@/fetchers/config/get-config";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { toast } from "@/lib/toast";

const signUpSearchSchema = z.object({
  email: z.string().optional(),
  redirect: z.string().optional(),
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

  const redirectPath = getSafeRedirectPath(search.redirect);
  const isInstanceAdminSetup = instanceStatus?.hasUsers === false;
  const destination = redirectPath ?? "/dashboard";
  // A join link does not open a closed instance.
  const selfServiceAllowed =
    !config?.disableRegistration || isInstanceAdminSetup;
  const passwordEnabled =
    selfServiceAllowed && isPasswordSignUpEnabled(config, isInstanceAdminSetup);

  const description = isInstanceAdminSetup
    ? t("auth:signUp.instanceAdminSubtitle")
    : passwordEnabled
      ? t("auth:signUp.subtitle.password")
      : undefined;

  if (config?.disableRegistration && !isInstanceAdminSetup) {
    return (
      <>
        <PageTitle title={t("auth:signUp.pageTitle")} />
        <RegistrationClosed />
      </>
    );
  }

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
      >
        {isConfigLoading ? <AuthFormSkeleton /> : null}
        {passwordEnabled ? (
          <PasswordSignUpForm
            defaultEmail={search.email}
            redirect={redirectPath}
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
                search={{ redirect: redirectPath, email: search.email }}
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
