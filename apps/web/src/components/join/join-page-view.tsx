import { Link } from "@tanstack/react-router";
import { Clock, LinkIcon, TriangleAlert } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import { Button, buttonVariants } from "@/components/ui/button";
import type { JoinLinkUnavailableReason } from "@/fetchers/join-link/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { JoinScreen } from "./join-screen-state";

export type JoinPageViewProps = {
  screen: JoinScreen;
  workspaceName: string | null;
  sharedByName: string | null;
  expiresAt: string | null;
  email: string | null;
  /** The server's own words for a refusal. Shown for a removed member. */
  serverMessage: string | null;
  onSignUp: () => void;
  onSignIn: () => void;
  onJoin: () => void;
  onSwitchAccount: () => void;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-svh w-full overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
        <div className="motion-shell-rise flex w-full max-w-[380px] flex-col items-center text-center">
          {children}
        </div>
      </div>
    </main>
  );
}

function Tile({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-16 items-center justify-center rounded-2xl border font-semibold text-2xl shadow-xs",
        muted
          ? "border-border bg-muted text-muted-foreground"
          : "border-foreground/10 bg-foreground text-background",
      )}
    >
      {children}
    </div>
  );
}

function unavailableCopy(t: TFunction, reason: JoinLinkUnavailableReason) {
  switch (reason) {
    case "expired":
      return {
        title: t("joinLink:page.unavailable.expired.title"),
        description: t("joinLink:page.unavailable.expired.description"),
      };
    case "revoked":
      return {
        title: t("joinLink:page.unavailable.revoked.title"),
        description: t("joinLink:page.unavailable.revoked.description"),
      };
    case "used_up":
      return {
        title: t("joinLink:page.unavailable.used_up.title"),
        description: t("joinLink:page.unavailable.used_up.description"),
      };
    default:
      return {
        title: t("joinLink:page.unavailable.not_found.title"),
        description: t("joinLink:page.unavailable.not_found.description"),
      };
  }
}

function GoToBaton() {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard"
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "mt-8 w-full",
      )}
    >
      {t("joinLink:page.goToBaton")}
    </Link>
  );
}

/** The join page. The workspace is the hero; every state shares one shell. */
export function JoinPageView(props: JoinPageViewProps) {
  const { t } = useTranslation();
  const { screen } = props;

  if (screen.kind === "loading") {
    return (
      <AuthPage title={t("joinLink:page.pageTitle")}>
        <AuthFormSkeleton />
      </AuthPage>
    );
  }

  if (screen.kind === "unavailable") {
    const copy = unavailableCopy(t, screen.reason);
    return (
      <Shell>
        <Tile muted>
          <LinkIcon className="size-6" />
        </Tile>
        <h1 className="mt-6 font-semibold text-[22px] leading-7 tracking-[-0.02em]">
          {copy.title}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">{copy.description}</p>
        <GoToBaton />
      </Shell>
    );
  }

  if (screen.kind === "failed" && screen.code === "generic") {
    return (
      <Shell>
        <Tile muted>
          <TriangleAlert className="size-6" />
        </Tile>
        <h1 className="mt-6 font-semibold text-[22px] leading-7 tracking-[-0.02em]">
          {t("joinLink:page.pageTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {t("joinLink:page.errors.generic")}
        </p>
        <GoToBaton />
      </Shell>
    );
  }

  const workspaceName = props.workspaceName ?? "";
  return (
    <Shell>
      <Tile>{workspaceName.slice(0, 1).toUpperCase()}</Tile>
      <p className="mt-6 text-muted-foreground text-sm">
        {props.sharedByName
          ? t("joinLink:page.invitedBy", { name: props.sharedByName })
          : t("joinLink:page.invitedAnon")}
      </p>
      <h1 className="mt-1 font-semibold text-[30px] leading-9 tracking-[-0.025em]">
        {workspaceName}
      </h1>
      {props.expiresAt ? (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground text-xs">
          <Clock className="size-3" aria-hidden="true" />
          {t("joinLink:page.expiresAt", {
            when: formatDateTime(props.expiresAt),
          })}
        </span>
      ) : null}

      <div className="mt-8 flex w-full flex-col gap-3">
        {screen.kind === "signed_out" ? (
          <>
            <Button size="lg" className="w-full" onClick={props.onSignUp}>
              {t("joinLink:page.signUp")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={props.onSignIn}
            >
              {t("joinLink:page.haveAccount")}
            </Button>
          </>
        ) : screen.kind === "failed" ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/32 bg-destructive/4 px-3.5 py-3 text-left text-sm"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            {screen.code === "REMOVED_FROM_WORKSPACE"
              ? (props.serverMessage ?? t("joinLink:page.errors.removed"))
              : screen.code === "WORKSPACE_MEMBER_LIMIT_REACHED"
                ? t("joinLink:page.errors.memberLimit")
                : t("joinLink:page.errors.rateLimited")}
          </p>
        ) : (
          <Button
            size="lg"
            className="w-full"
            loading={screen.kind === "joining"}
            onClick={props.onJoin}
          >
            {t("joinLink:page.join", { workspaceName })}
          </Button>
        )}
      </div>

      {screen.kind !== "signed_out" ? (
        <p className="mt-6 text-muted-foreground text-xs">
          {props.email
            ? `${t("joinLink:page.joiningAs", { email: props.email })} · `
            : null}
          <button
            type="button"
            className={authLinkClassName}
            onClick={props.onSwitchAccount}
          >
            {t("joinLink:page.switchAccount")}
          </button>
        </p>
      ) : null}
    </Shell>
  );
}
