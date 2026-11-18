import { GlobeIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSetTimeZone } from "@/hooks/mutations/user/use-set-time-zone";
import { useNow } from "@/hooks/use-now";
import { clockText } from "@/lib/time-zone/format-zone-clock";
import { displayZone } from "@/lib/time-zone/zone-options";
import { toast } from "@/lib/toast";
import { TimeZonePicker } from "./time-zone-picker";
import type { ZonePrompt } from "./zone-prompt-state";

export type VisiblePrompt = Exclude<ZonePrompt, { kind: "hidden" }>;

type Props = {
  prompt: VisiblePrompt;
  /** "browser" remembers it on this device; "session" asks again next visit. */
  onDismiss: (scope: "browser" | "session") => void;
};

/**
 * A non-modal card in the corner. It never blocks the page. Unset offers
 * Confirm and Change; a mismatch offers Use and Keep. Close and Keep remember
 * the answer for this device zone.
 */
export default function TimeZonePrompt({ prompt, onDismiss }: Props) {
  const { t } = useTranslation("timeZone");
  const now = useNow();
  const save = useSetTimeZone();
  const [view, setView] = useState<"summary" | "picking">("summary");
  const busy = save.isPending;
  const zone = displayZone(prompt.detected);
  // A failed save keeps the prompt and its toast; the buttons work again.
  const submit = (next: string) =>
    save.mutate(next, { onSuccess: () => toast.success(t("prompt.saved")) });
  const dismissScope = prompt.kind === "unset" ? "session" : "browser";

  return (
    <section
      aria-label={t("picker.label")}
      className="motion-zone-prompt fixed inset-x-3 bottom-3 z-40 rounded-xl border bg-popover text-popover-foreground shadow-lg/10 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-muted-foreground">
          <GlobeIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 font-medium">
            {prompt.kind === "unset"
              ? t("prompt.unset.title")
              : t("prompt.mismatch.title", { zone })}
          </p>

          {view === "picking" ? (
            <div className="mt-3 space-y-2">
              <TimeZonePicker
                value={prompt.detected}
                disabled={busy}
                defaultOpen
                autoFocus
                onChange={submit}
                onEscape={() => setView("summary")}
              />
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => setView("summary")}
              >
                {t("prompt.back")}
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                {prompt.kind === "unset"
                  ? t("prompt.unset.detected", {
                      zone,
                      time: clockText(prompt.detected, now),
                    })
                  : t("prompt.mismatch.body", {
                      stored: displayZone(prompt.stored),
                      storedTime: clockText(prompt.stored, now),
                      deviceTime: clockText(prompt.detected, now),
                    })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {prompt.kind === "unset" ? (
                  <>
                    <Button
                      size="sm"
                      loading={busy}
                      onClick={() => submit(prompt.detected)}
                    >
                      {t("prompt.unset.confirm")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setView("picking")}
                    >
                      {t("prompt.change")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      loading={busy}
                      className="max-w-full"
                      onClick={() => submit(prompt.detected)}
                    >
                      <span className="truncate">
                        {t("prompt.mismatch.confirm", { zone })}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="max-w-full"
                      onClick={() => onDismiss("browser")}
                    >
                      <span className="truncate">
                        {t("prompt.mismatch.keep", {
                          zone: displayZone(prompt.stored),
                        })}
                      </span>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
          {save.isError ? (
            <p
              role="alert"
              className="mt-2 text-xs text-destructive-foreground"
            >
              {t("prompt.saveFailed")}
            </p>
          ) : null}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("prompt.dismiss")}
          disabled={busy}
          onClick={() => onDismiss(dismissScope)}
        >
          <XIcon />
        </Button>
      </div>
    </section>
  );
}
