import type { Person, Status } from "@/components/board/model";

export type { Person, Status };

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

/** A task on the other end of a waits-on link. */
export type Linked = {
  key: string;
  title: string;
  status: Status;
  owner: Person | null;
  /** Label for the last change, e.g. "2d ago". */
  since: string;
  /** Other open tasks this one still waits on, besides the one on this page. */
  otherBlockers?: number;
};

export type ChangeRequest = {
  id: string;
  requester: Person;
  to: Status;
  /** Label, e.g. "expires in 21h". */
  expires: string;
};

export type ActivityKind =
  | "created"
  | "comment"
  | "status"
  | "assign"
  | "priority"
  | "relation"
  | "pr";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  actor: Person;
  /** Label, e.g. "2h ago". */
  at: string;
  /** Used to order entries from different sources. */
  hoursAgo: number;
  /** Comment text, or the object of the change ("API-18"). */
  body?: string;
  from?: string;
  to?: string;
};

export type PullRequest = {
  number: number;
  title: string;
  state: "open" | "merged" | "closed";
  checks: "passing" | "failing" | "pending";
  branch: string;
};

export type TaskDetail = {
  key: string;
  repo: string;
  title: string;
  /** The task's own status as stored. Not trusted: `deriveTaskView` decides. */
  status: string;
  priority: Priority;
  creator: Person;
  assignee: Person | null;
  /** Label, e.g. "Fri, Nov 20", plus whether it is close or past. */
  due: { label: string; tone: "ok" | "soon" | "overdue" } | null;
  labels: string[];
  description: string[];
  waitsOn: Linked[];
  blocks: Linked[];
  related: Linked[];
  request: ChangeRequest | null;
  activity: ActivityEntry[];
  pullRequest: PullRequest | null;
  createdAgo: string;
};

export type Viewer = {
  person: Person;
  /** The creator and the assignee are involved; others ask. */
  involved: boolean;
};

export type DataSetId = "a" | "b" | "busy";
