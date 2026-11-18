import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseJoinToken } from "@/lib/join-link";

type StartStepProps = {
  /** False when the instance limits who can create workspaces. */
  canCreate: boolean;
  onCreate: () => void;
  onJoin: (token: string) => void;
};

/** First step: paste a join link, or (if allowed) start a new workspace. */
export function StartStep({ canCreate, onCreate, onJoin }: StartStepProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const token = parseJoinToken(value);
          if (!token) {
            setInvalid(true);
            return;
          }
          onJoin(token);
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-join-link">
            {t("joinLink:onboarding.join.label")}
          </Label>
          <Input
            id="onboarding-join-link"
            size="lg"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder={t("joinLink:onboarding.join.placeholder")}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={
              invalid ? "onboarding-join-link-error" : undefined
            }
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
          />
          {invalid ? (
            <p
              id="onboarding-join-link-error"
              role="alert"
              className={authMessageClassName}
            >
              {t("joinLink:onboarding.join.invalid")}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="self-start">
          {t("joinLink:onboarding.join.continue")}
        </Button>
      </form>
      {canCreate ? (
        <p className="text-muted-foreground text-sm">
          {t("joinLink:onboarding.create.prompt")}{" "}
          <button
            type="button"
            className="cursor-pointer text-foreground underline underline-offset-[3px] outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onCreate}
          >
            {t("joinLink:onboarding.create.title")}
          </button>
        </p>
      ) : null}
    </div>
  );
}
