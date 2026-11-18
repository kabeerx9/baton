import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import {
  authFieldClassName,
  authLabelClassName,
  authMessageClassName,
} from "./auth-form-styles";
import { PasswordInput } from "./password-input";

type PasswordSignUpValues = { name: string; email: string; password: string };

type PasswordSignUpFormProps = {
  defaultEmail?: string;
  /** Where the person goes after sign-up. Kept if a verification step comes first. */
  redirect?: string;
  disabled?: boolean;
  onSuccess: () => void;
};

export function PasswordSignUpForm({
  defaultEmail,
  redirect,
  disabled = false,
  onSuccess,
}: PasswordSignUpFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("auth:forms.nameRequired")),
        email: z.email(t("auth:forms.invalidEmail")),
        password: z
          .string()
          .min(8, t("auth:forms.passwordTooShort"))
          .max(128, t("auth:passwordReset.passwordLength")),
      }),
    [t],
  );
  const form = useForm<PasswordSignUpValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: "", email: defaultEmail ?? "", password: "" },
  });

  const onSubmit = async ({ name, email, password }: PasswordSignUpValues) => {
    setIsPending(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });
      if (result.error) {
        if (result.error.code === "DISPOSABLE_EMAIL_NOT_ALLOWED") {
          form.setError("email", { message: t("auth:forms.disposableEmail") });
        } else {
          toast.error(result.error.message || t("auth:signUp.failed"));
        }
        setIsPending(false);
        return;
      }
      // The instance requires a confirmed email: no session until then.
      if (!result.data?.token) {
        toast.success(t("auth:signUp.verifyEmail"));
        await navigate({ to: "/auth/sign-in", search: { redirect } });
        return;
      }
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:signUp.failed"),
      );
      setIsPending(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.name")}
              </FormLabel>
              <FormControl>
                <Input
                  size="lg"
                  autoComplete="name"
                  placeholder={t("auth:forms.namePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.email")}
              </FormLabel>
              <FormControl>
                <Input
                  size="lg"
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth:forms.emailPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.password")}
              </FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder={t("auth:forms.passwordPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          disabled={disabled}
        >
          {t("auth:signUp.submitPassword")}
        </Button>
      </form>
    </Form>
  );
}
