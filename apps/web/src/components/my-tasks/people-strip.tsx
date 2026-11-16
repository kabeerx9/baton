import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import type { WaitingPerson } from "./focus-plan";
import { PersonTile } from "./person-tile";

const SHOWN = 4;

/** Who is stuck behind my work: one tile per teammate, the most urgent first. */
export function PeopleStrip({
  people,
  nextId,
  onFocus,
}: {
  people: WaitingPerson[];
  nextId: string | null;
  onFocus: (task: AssignedTask) => void;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  if (people.length === 0) return null;
  const shown = all ? people : people.slice(0, SHOWN);
  return (
    <section
      aria-label={t("workspace:myTasks.people.title")}
      className="flex flex-col gap-2.5"
    >
      <h2 className="flex items-baseline gap-2 font-semibold text-sm">
        {t("workspace:myTasks.people.title")}
        <span className="font-normal text-muted-foreground text-xs tabular-nums">
          {people.length}
        </span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((person) => (
          <PersonTile
            key={person.name ?? ""}
            nextId={nextId}
            onFocus={onFocus}
            person={person}
          />
        ))}
      </ul>
      {people.length > SHOWN ? (
        <Button
          className="self-start"
          onClick={() => setAll(!all)}
          size="xs"
          variant="ghost"
        >
          {all
            ? t("workspace:myTasks.showFewer")
            : t("workspace:myTasks.people.showMore", {
                count: people.length - SHOWN,
              })}
        </Button>
      ) : null}
    </section>
  );
}
