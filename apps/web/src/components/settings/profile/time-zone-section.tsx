import {
  CheckIcon,
  CircleAlertIcon,
  Loader2Icon,
  PencilIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { TimeZonePicker } from "@/components/time-zone/time-zone-picker";
import { Button } from "@/components/ui/button";
import { useSetTimeZone } from "@/hooks/mutations/user/use-set-time-zone";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";
import { useNow } from "@/hooks/use-now";
import { detectTimeZone } from "@/lib/time-zone/detect-time-zone";
import { clockText, dayText } from "@/lib/time-zone/format-zone-clock";
import { sameZone } from "@/lib/time-zone/same-zone";
import { displayZone } from "@/lib/time-zone/zone-options";

/**
 * The saved time zone, read first: the zone and its live clock, with the picker
 * only after Change. A pick saves at once. The save lifecycle is the mutation's.
 */
export function TimeZoneSection() {
  const { t } = useTranslation("timeZone");
  const now = useNow();
  const { data: me } = useCurrentUser();
  const save = useSetTimeZone();
  const [view, setView] = useState<"summary" | "picking">("summary");
  const detected = useMemo(() => detectTimeZone(), []);

  // Wait for the account, so the row never flashes "Not set" for a saved zone.
  if (!me || me.timeZone === undefined) return null;

  const pending = save.isPending ? save.variables : undefined;
  const zone = pending ?? me.timeZone;
  const differs =
    zone !== null && detected !== null && !sameZone(zone, detected, now);
  const choose = (next: string) => {
    setView("summary");
    save.mutate(next);
  };

  return (
    <SettingsSection
      title={t("settings.title")}
      description={t("settings.description")}
    >
      <SettingsCard>
        <SettingsRow
          stack
          title={
            view === "summary" ? (
              zone ? (
                displayZone(zone)
              ) : (
                <span className="text-muted-foreground">
                  {t("settings.notSet")}
                </span>
              )
            ) : (
              t("picker.label")
            )
          }
          description={
            view === "summary" ? (
              zone ? (
                <span className="tabular-nums">
                  {clockText(zone, now)} · {dayText(zone, now)}
                </span>
              ) : detected ? (
                t("settings.notSetHint", { zone: displayZone(detected) })
              ) : null
            ) : null
          }
        >
          {view === "picking" ? (
            <>
              <div className="w-64 max-w-[60vw]">
                <TimeZonePicker
                  value={zone ?? detected}
                  defaultOpen
                  autoFocus
                  size="sm"
                  onChange={choose}
                  onEscape={() => setView("summary")}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setView("summary")}
              >
                {t("settings.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => setView("picking")}
            >
              <PencilIcon />
              {zone ? t("settings.change") : t("settings.set")}
            </Button>
          )}
        </SettingsRow>
        {differs && detected ? (
          <SettingsRow
            stack
            title={
              <span className="font-normal text-muted-foreground">
                {t("settings.deviceHint", { zone: displayZone(detected) })}
              </span>
            }
          >
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => choose(detected)}
            >
              {t("settings.useDevice")}
            </Button>
          </SettingsRow>
        ) : null}
      </SettingsCard>
      <p
        role="status"
        aria-live="polite"
        className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground"
      >
        {save.status === "pending" && (
          <>
            <Loader2Icon
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
            />
            {t("settings.saving")}
          </>
        )}
        {save.status === "success" && (
          <>
            <CheckIcon aria-hidden="true" className="size-3.5" />
            {t("settings.saved")}
          </>
        )}
        {save.status === "error" && save.variables && (
          <>
            <CircleAlertIcon aria-hidden="true" className="size-3.5" />
            {t("settings.saveFailedFor", { zone: displayZone(save.variables) })}
            <Button
              size="xs"
              variant="link"
              className="h-auto p-0"
              onClick={() => save.mutate(save.variables)}
            >
              {t("settings.retry")}
            </Button>
          </>
        )}
      </p>
    </SettingsSection>
  );
}
