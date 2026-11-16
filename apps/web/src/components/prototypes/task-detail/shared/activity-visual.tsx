import {
  CircleDotIcon,
  FlagIcon,
  GitPullRequestIcon,
  LinkIcon,
  MessageSquareIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import type { ActivityEntry, ActivityKind } from "../types";

const ICON = {
  created: SparklesIcon,
  comment: MessageSquareIcon,
  status: CircleDotIcon,
  assign: UserRoundIcon,
  priority: FlagIcon,
  relation: LinkIcon,
  pr: GitPullRequestIcon,
} as const satisfies Record<ActivityKind, unknown>;

export function ActivityIcon({
  kind,
  className = "size-3.5",
}: {
  kind: ActivityKind;
  className?: string;
}) {
  const Icon = ICON[kind] ?? CircleDotIcon;
  return <Icon className={className} aria-hidden="true" />;
}

const first = (name: string) => name.split(" ")[0] ?? name;

/** The change as a short phrase, without the actor. A comment has no phrase. */
export function describeChange(e: ActivityEntry): string {
  switch (e.kind) {
    case "created":
      return "created this task";
    case "status":
      return e.body
        ? `moved ${e.body} from ${e.from} to ${e.to}`
        : `moved it from ${e.from} to ${e.to}`;
    case "assign":
      return e.to === "nobody"
        ? "unassigned it"
        : `assigned it to ${first(e.to ?? "")}`;
    case "priority":
      return `set priority to ${e.to}`;
    case "relation":
      return `made it ${e.to} ${e.body}`;
    case "pr":
      return `pull request ${e.body}`;
    case "comment":
      return "commented";
  }
}
