import {
  CalendarIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleCheckIcon,
  CircleIcon,
  SignalHighIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { PersonAvatar } from "./parts";

const HISTORY = [
  { who: "Aakash", text: "created this task", when: "2 days ago" },
  { who: "Neha", text: "changed status from Todo to Doing", when: "yesterday" },
  { who: "Priya", text: "added the label backend", when: "yesterday" },
];

type TaskShellProps = {
  statusSlug: string;
  /** Next to the title key, in the header row. */
  headerSlot?: ReactNode;
  /** Right after the Status property. */
  statusHint?: ReactNode;
  /** Between the properties and the description. */
  aboveDescription?: ReactNode;
  /** At the end of the activity list, inside the rail. */
  activityTail?: ReactNode;
};

const STATUS_ICON: Record<string, ReactNode> = {
  todo: <CircleIcon className="size-4 text-muted-foreground" />,
  doing: <CircleDotIcon className="size-4 text-info-foreground" />,
  review: <CircleDashedIcon className="size-4 text-warning-foreground" />,
  done: <CircleCheckIcon className="size-4 text-success-foreground" />,
};

const STATUS_NAME: Record<string, string> = {
  todo: "Todo",
  doing: "Doing",
  review: "In review",
  done: "Done",
};

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground text-xs">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A stand-in task page that follows the real page's layout and tokens. */
export function TaskShell({
  statusSlug,
  headerSlot,
  statusHint,
  aboveDescription,
  activityTail,
}: TaskShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-16 pb-40">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-muted-foreground text-xs"
      >
        <span>Baton</span>
        <ChevronRightIcon className="size-3" />
        <span>Platform</span>
        <ChevronRightIcon className="size-3" />
        <span className="font-medium text-foreground">API-12</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs">
            API-12
          </span>
          {headerSlot}
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Rate-limit the webhook retry queue
        </h1>
        <div className="flex flex-col gap-2 pt-1">
          <Property label="Status">
            <span className="flex items-center gap-1.5">
              {STATUS_ICON[statusSlug]}
              {STATUS_NAME[statusSlug] ?? statusSlug}
            </span>
            {statusHint}
          </Property>
          <Property label="Assignee">
            <span className="flex items-center gap-1.5">
              <PersonAvatar name="Neha Rao" />
              Neha Rao
            </span>
          </Property>
          <Property label="Priority">
            <span className="flex items-center gap-1.5">
              <SignalHighIcon className="size-4 text-muted-foreground" />
              High
            </span>
          </Property>
          <Property label="Due">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-4 text-muted-foreground" />
              Fri, 20 Nov
            </span>
          </Property>
        </div>
      </header>

      {aboveDescription}

      <section aria-label="Description" className="flex flex-col gap-2 text-sm">
        <p>
          Failed webhook deliveries retry with no ceiling. A single bad endpoint
          can fill the queue and delay every other customer.
        </p>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>Cap retries per endpoint at 5 per minute.</li>
          <li>Back off with jitter after the third failure.</li>
          <li>Show the cap in the delivery log.</li>
        </ul>
      </section>

      <section aria-label="Activity" className="flex flex-col gap-1">
        <h2 className="flex h-7 items-center pb-1 font-medium text-[13px]">
          Activity
        </h2>
        <ol className="relative flex flex-col gap-4 border-border border-s ps-5">
          {HISTORY.map((item) => (
            <li
              className="relative flex items-center gap-2 text-sm"
              key={item.text}
            >
              <span className="-start-[25px] absolute size-2 rounded-full bg-border" />
              <PersonAvatar name={item.who} />
              <span>
                <span className="font-medium">{item.who}</span>{" "}
                <span className="text-muted-foreground">{item.text}</span>
              </span>
              <span className="ms-auto text-muted-foreground text-xs">
                {item.when}
              </span>
            </li>
          ))}
          {activityTail}
        </ol>
      </section>
    </div>
  );
}
