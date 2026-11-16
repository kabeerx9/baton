import { DANA, KABEER, LENA, PRIYA, SAM } from "./people";
import type { DataSetId, TaskDetail } from "./types";

/** A: sparse, to do, waiting on two tasks, one task waiting on it. */
const A: TaskDetail = {
  key: "APP-31",
  repo: "App",
  title: "Match push notifications",
  status: "todo",
  priority: "none",
  creator: KABEER,
  assignee: null,
  due: null,
  labels: [],
  description: [
    "Push copy and the in-app inbox should say the same thing. Today the push says “Task ready” while the inbox says “You can continue”.",
  ],
  waitsOn: [
    {
      key: "API-18",
      title: "Send a push when a blocker finishes",
      status: "doing",
      owner: DANA,
      since: "started 2d ago",
    },
    {
      key: "DS-9",
      title: "Write notification copy for every event",
      status: "todo",
      owner: null,
      since: "no owner yet",
    },
  ],
  blocks: [
    {
      key: "APP-36",
      title: "Notification settings screen",
      status: "todo",
      owner: SAM,
      since: "waiting 3d",
    },
  ],
  related: [],
  request: null,
  activity: [
    {
      id: "a1",
      kind: "created",
      actor: KABEER,
      at: "3d ago",
      hoursAgo: 72,
    },
  ],
  pullRequest: null,
  createdAgo: "3d ago",
};

/** B: sparse, done, assigned, empty description, one task released. */
const B: TaskDetail = {
  key: "APP-35",
  repo: "App",
  title: "Check notifications on iOS and Android",
  status: "done",
  priority: "medium",
  creator: KABEER,
  assignee: PRIYA,
  due: { label: "Mon, Nov 16", tone: "ok" },
  labels: ["QA"],
  description: [],
  waitsOn: [],
  blocks: [
    {
      key: "APP-40",
      title: "Release 1.8 candidate",
      status: "todo",
      owner: KABEER,
      since: "waiting 1d",
    },
  ],
  related: [],
  request: null,
  activity: [
    {
      id: "b1",
      kind: "status",
      actor: PRIYA,
      at: "1d ago",
      hoursAgo: 26,
      from: "In review",
      to: "Done",
    },
  ],
  pullRequest: null,
  createdAgo: "6d ago",
};

/** Busy: review, a pending request, a pull request, a long thread. */
const BUSY: TaskDetail = {
  key: "API-22",
  repo: "API",
  title: "Reconnect live scoring sockets without dropping events",
  status: "review",
  priority: "high",
  creator: KABEER,
  assignee: PRIYA,
  due: { label: "Wed, Nov 18", tone: "soon" },
  labels: ["Realtime", "Reliability", "Hosted"],
  description: [
    "When a phone loses signal for a few seconds, the live scoring screen reconnects but misses the events sent in between. Fans then see a stale score until the next point.",
    "Reconnect should ask the API for everything after the last event the client saw, then switch to the live stream. The client keeps the last event id; the API replays from there.",
    "Done when: a client offline for 30 seconds sees every point, in order, with no duplicates, and the board stays fast.",
  ],
  waitsOn: [
    {
      key: "API-17",
      title: "Give every event a sequence number",
      status: "done",
      owner: DANA,
      since: "finished 2d ago",
    },
    {
      key: "INF-6",
      title: "Redis fan-out for hosted instances",
      status: "review",
      owner: LENA,
      since: "in review 5h",
    },
  ],
  blocks: [
    {
      key: "APP-44",
      title: "Show a reconnecting banner",
      status: "todo",
      owner: SAM,
      since: "waiting 2d",
    },
    {
      key: "APP-47",
      title: "Score screen: resume from last event",
      status: "doing",
      owner: PRIYA,
      since: "waiting 1d",
      otherBlockers: 1,
    },
    {
      key: "QA-12",
      title: "Flaky network test pass",
      status: "todo",
      owner: null,
      since: "waiting 4d",
    },
  ],
  related: [
    {
      key: "API-9",
      title: "WebSocket heartbeat interval",
      status: "done",
      owner: DANA,
      since: "closed 3w ago",
    },
  ],
  request: {
    id: "cr1",
    requester: SAM,
    to: "done",
    expires: "expires in 21h",
  },
  activity: [
    {
      id: "c10",
      kind: "comment",
      actor: SAM,
      at: "12m ago",
      hoursAgo: 0.2,
      body: "Tested on a throttled connection. Replay worked for 30 seconds offline. I asked to close this, since the pull request is green.",
    },
    {
      id: "c9",
      kind: "pr",
      actor: PRIYA,
      at: "1h ago",
      hoursAgo: 1,
      body: "#218 checks passed",
    },
    {
      id: "c8",
      kind: "comment",
      actor: LENA,
      at: "3h ago",
      hoursAgo: 3,
      body: "INF-6 is in review. Fan-out works behind the adapter, and a single instance without Redis still replays from memory.",
    },
    {
      id: "c7",
      kind: "status",
      actor: PRIYA,
      at: "5h ago",
      hoursAgo: 5,
      from: "In progress",
      to: "In review",
    },
    {
      id: "c6",
      kind: "comment",
      actor: DANA,
      at: "1d ago",
      hoursAgo: 24,
      body: "Sequence numbers are in. Use `seq` from the event envelope, not the timestamp.",
    },
    {
      id: "c5",
      kind: "relation",
      actor: KABEER,
      at: "2d ago",
      hoursAgo: 48,
      body: "API-17",
      to: "waits on",
    },
    {
      id: "c4",
      kind: "priority",
      actor: KABEER,
      at: "3d ago",
      hoursAgo: 72,
      from: "Medium",
      to: "High",
    },
    {
      id: "c3",
      kind: "assign",
      actor: KABEER,
      at: "4d ago",
      hoursAgo: 96,
      to: "Priya Nair",
    },
    {
      id: "c2",
      kind: "comment",
      actor: PRIYA,
      at: "4d ago",
      hoursAgo: 95,
      body: "I can take this. I will replay from the last seq and fall back to a full refresh if the gap is too big.",
    },
    {
      id: "c1",
      kind: "created",
      actor: KABEER,
      at: "5d ago",
      hoursAgo: 120,
    },
  ],
  pullRequest: {
    number: 218,
    title: "Replay missed events on reconnect",
    state: "open",
    checks: "passing",
    branch: "priya/replay-on-reconnect",
  },
  createdAgo: "5d ago",
};

export const DATA_SETS: Record<DataSetId, { label: string; task: TaskDetail }> =
  {
    a: { label: "A · Sparse, to do", task: A },
    b: { label: "B · Sparse, done", task: B },
    busy: { label: "Busy · In review", task: BUSY },
  };
