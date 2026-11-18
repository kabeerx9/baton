import { Check, Copy, Link2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateJoinLinkInput, JoinLink } from "@/fetchers/join-link/types";
import { useCreateJoinLink } from "@/hooks/mutations/join-link/use-create-join-link";
import { useRevokeJoinLink } from "@/hooks/mutations/join-link/use-revoke-join-link";
import { useJoinLink } from "@/hooks/queries/join-link/use-join-link";
import { cn } from "@/lib/cn";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { JoinLinkForm } from "./join-link-form";
import { deriveJoinLinkView, needsReplaceConfirm } from "./join-link-view";

type Flow =
  | { kind: "idle" }
  | { kind: "form" }
  | { kind: "confirm_replace"; input: Required<CreateJoinLinkInput> }
  | { kind: "confirm_revoke" };

const FORM_ID = "join-link-form";

/** The workspace's one join link. Shown to people who may manage it. */
export function JoinLinkCard({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: link, isError } = useJoinLink(workspaceId, true);
  const create = useCreateJoinLink(workspaceId);
  const revoke = useRevokeJoinLink(workspaceId);
  const [flow, setFlow] = useState<Flow>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const view = deriveJoinLinkView(link, Date.now());
  const busy = create.isPending || revoke.isPending;

  const runCreate = (input: Required<CreateJoinLinkInput>) => {
    create.mutate(input, {
      onSuccess: () => {
        setFlow({ kind: "idle" });
        toast.success(t("joinLink:card.created"));
      },
      onError: () => {
        setFlow({ kind: "idle" });
        toast.error(t("joinLink:card.errors.create"));
      },
    });
  };

  const runRevoke = () => {
    revoke.mutate(undefined, {
      onSuccess: () => toast.success(t("joinLink:card.revoked")),
      onError: () => toast.error(t("joinLink:card.errors.revoke")),
    });
  };

  const copy = async (url: string) => {
    if (!(await copyToClipboard(url))) {
      toast.error(t("joinLink:card.copyFailed"));
      return;
    }
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const submitForm = (input: Required<CreateJoinLinkInput>) => {
    if (needsReplaceConfirm(view)) setFlow({ kind: "confirm_replace", input });
    else runCreate(input);
  };

  const closeFlow = (open: boolean) => {
    if (!open) setFlow({ kind: "idle" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("joinLink:card.title")}
          {view.kind === "expired" ? (
            <Badge variant="warning">{t("joinLink:card.expired")}</Badge>
          ) : view.kind === "used_up" ? (
            <Badge variant="warning">{t("joinLink:card.usedUp")}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{t("joinLink:card.description")}</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-4 px-6 pb-6">
        {isError ? (
          <p role="alert" className="text-destructive-foreground text-sm">
            {t("joinLink:card.errors.load")}
          </p>
        ) : view.kind === "none" ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border border-dashed px-4 py-5">
            <p className="text-muted-foreground text-sm">
              {t("joinLink:card.empty")}
            </p>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setFlow({ kind: "form" })}
            >
              <Plus />
              {t("joinLink:card.create")}
            </Button>
          </div>
        ) : link ? (
          <>
            {view.kind === "active" ? (
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-input bg-muted/50 px-3 py-2 font-mono text-[13px]">
                  {view.url}
                </code>
                <Button
                  variant="outline"
                  className="min-w-24"
                  onClick={() => copy(view.url)}
                >
                  {copied ? <Check /> : <Copy />}
                  <span aria-live="polite">
                    {copied
                      ? t("joinLink:card.copied")
                      : t("joinLink:card.copy")}
                  </span>
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-input border-dashed bg-muted/30 px-3 py-2.5 text-muted-foreground text-sm">
                {t("joinLink:card.copyUnavailable")}
              </p>
            )}
            <LinkStats link={link} view={view.kind} />
            <div className="flex gap-2 border-border border-t pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setFlow({ kind: "form" })}
              >
                {t("joinLink:card.createNew")}
              </Button>
              {needsReplaceConfirm(view) ? (
                <Button
                  size="sm"
                  variant="destructive-outline"
                  disabled={busy}
                  onClick={() => setFlow({ kind: "confirm_revoke" })}
                >
                  {t("joinLink:card.revoke")}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={flow.kind === "form"} onOpenChange={closeFlow}>
        <DialogPopup className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>
              {view.kind === "none"
                ? t("joinLink:card.create")
                : t("joinLink:card.createNew")}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <JoinLinkForm id={FORM_ID} onSubmit={submitForm} />
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </DialogClose>
            <Button
              type="submit"
              form={FORM_ID}
              size="sm"
              loading={create.isPending}
            >
              {needsReplaceConfirm(view)
                ? t("joinLink:card.replaceConfirm.confirm")
                : t("joinLink:card.create")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={flow.kind === "confirm_replace" || flow.kind === "confirm_revoke"}
        onOpenChange={closeFlow}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {flow.kind === "confirm_revoke"
                ? t("joinLink:card.revokeConfirm.title")
                : t("joinLink:card.replaceConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {flow.kind === "confirm_revoke"
                ? t("joinLink:card.revokeConfirm.body")
                : t("joinLink:card.replaceConfirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              size="sm"
              variant={
                flow.kind === "confirm_revoke" ? "destructive" : "default"
              }
              loading={busy}
              onClick={() => {
                if (flow.kind === "confirm_replace") runCreate(flow.input);
                else if (flow.kind === "confirm_revoke") {
                  setFlow({ kind: "idle" });
                  runRevoke();
                }
              }}
            >
              {flow.kind === "confirm_revoke"
                ? t("joinLink:card.revokeConfirm.confirm")
                : t("joinLink:card.replaceConfirm.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function LinkStats({
  link,
  view,
}: {
  link: JoinLink;
  view: ReturnType<typeof deriveJoinLinkView>["kind"];
}) {
  const { t } = useTranslation();
  const pct =
    link.maxUses && link.maxUses > 0
      ? Math.min(100, (link.useCount / link.maxUses) * 100)
      : 0;
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground text-xs">
          {view === "expired"
            ? t("joinLink:card.expiredLabel")
            : t("joinLink:card.expiresLabel")}
        </dt>
        <dd>{formatRelativeTime(link.expiresAt)}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground text-xs">
          {t("joinLink:card.usesLabel")}
        </dt>
        <dd className="flex flex-col gap-1.5">
          <span>
            {link.maxUses === null
              ? t("joinLink:card.uses", { count: link.useCount })
              : t("joinLink:card.usesOfMax", {
                  count: link.useCount,
                  max: link.maxUses,
                })}
          </span>
          {link.maxUses !== null ? (
            <span
              role="progressbar"
              aria-valuenow={link.useCount}
              aria-valuemin={0}
              aria-valuemax={link.maxUses}
              aria-label={t("joinLink:card.usesLabel")}
              className="h-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className={cn(
                  "block h-full rounded-full",
                  view === "used_up" ? "bg-warning" : "bg-foreground",
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}
