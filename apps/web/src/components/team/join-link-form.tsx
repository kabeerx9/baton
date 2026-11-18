import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import type {
  CreateJoinLinkInput,
  JoinLinkExpiry,
} from "@/fetchers/join-link/types";
import { parseMaxUses } from "./join-link-view";

const EXPIRIES: readonly JoinLinkExpiry[] = ["30m", "24h", "7d"];

type JoinLinkFormProps = {
  id: string;
  /** Called with a valid input only. */
  onSubmit: (input: Required<CreateJoinLinkInput>) => void;
};

/** Expiry and maximum uses. Submit it with a button that has `form={id}`. */
export function JoinLinkForm({ id, onSubmit }: JoinLinkFormProps) {
  const { t } = useTranslation();
  const [expiresIn, setExpiresIn] = useState<JoinLinkExpiry>("24h");
  const [maxUsesText, setMaxUsesText] = useState("");
  const [touched, setTouched] = useState(false);
  const parsed = parseMaxUses(maxUsesText);
  const invalid = touched && !parsed.ok;

  return (
    <form
      id={id}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (parsed.ok) onSubmit({ expiresIn, maxUses: parsed.value });
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label id={`${id}-expiry`}>{t("joinLink:form.expiry.label")}</Label>
          <SegmentedControl
            aria-labelledby={`${id}-expiry`}
            value={expiresIn}
            onChoose={(next) => {
              const choice = EXPIRIES.find((option) => option === next);
              if (choice) setExpiresIn(choice);
            }}
          >
            {EXPIRIES.map((option) => (
              <SegmentedControlItem key={option} value={option} className="h-8">
                {t(`joinLink:form.expiry.${option}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-max`}>
            {t("joinLink:form.maxUses.label")}
          </Label>
          <Input
            id={`${id}-max`}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("joinLink:form.maxUses.placeholder")}
            value={maxUsesText}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? `${id}-max-error` : undefined}
            onChange={(event) => setMaxUsesText(event.target.value)}
          />
          {invalid ? (
            <p
              id={`${id}-max-error`}
              role="alert"
              className="text-destructive-foreground text-xs"
            >
              {t("joinLink:form.maxUses.invalid")}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
