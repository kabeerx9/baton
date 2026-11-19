import { AISHA, KABEER, MARIA, ROHAN } from "./people";
import { blockerOf, makeFeature, makeTask } from "./make-task";
import { linkedFeature, type Scenario } from "./scenario-types";

const scoreFanOut = makeTask({
  key: "API-33",
  title: "Fan out score updates over WebSocket",
  status: "review",
  owner: ROHAN,
});

/** 12 tasks, 3 owners, 2 blocked (one on another feature), 1 pending request. */
export const BIG: Scenario = {
  id: "big",
  label: "Big feature · 12 tasks",
  feature: makeFeature({
    key: "T-41",
    title: "Live scoring",
    summary: "Clubs see the score change as it happens.",
    owner: KABEER,
    subtasks: [
      makeTask({
        key: "API-31",
        title: "Score events table and migration",
        status: "done",
        owner: ROHAN,
      }),
      makeTask({
        key: "API-32",
        title: "POST /scores endpoint",
        status: "done",
        owner: ROHAN,
      }),
      makeTask({
        key: "ENG-8",
        title: "Scoring rules for T20",
        status: "done",
        owner: AISHA,
      }),
      scoreFanOut,
      makeTask({
        key: "WEB-41",
        title: "Live score card component",
        status: "review",
        owner: KABEER,
      }),
      makeTask({
        key: "WEB-42",
        title: "Scoreboard page and route",
        status: "doing",
        owner: KABEER,
      }),
      makeTask({
        key: "WEB-43",
        title: "Reconnect and stale-score banner",
        status: "doing",
        owner: KABEER,
      }),
      makeTask({
        key: "ENG-9",
        title: "Super-over tie-break rules",
        status: "doing",
        owner: AISHA,
        request: {
          id: "req-1",
          kind: "status",
          targetStatus: "done",
          requestedBy: MARIA.id,
          channel: "web",
          expiresAt: "2026-11-20T09:00:00.000Z",
        },
      }),
      makeTask({
        key: "WEB-44",
        title: "Share a score link",
        status: "todo",
        owner: KABEER,
        waitsOn: [blockerOf(scoreFanOut, ROHAN)],
        blockedBy: [scoreFanOut.id],
      }),
      makeTask({
        key: "WEB-45",
        title: "Push alerts for wickets",
        status: "todo",
        owner: AISHA,
        // In another feature: Mobile notifications (T-52).
        waitsOn: [
          {
            id: "id-APP-17",
            key: "APP-17",
            title: "Register push tokens",
            assigneeName: MARIA.name,
          },
        ],
      }),
      makeTask({
        key: "API-34",
        title: "Rate limit score writes",
        status: "todo",
        owner: ROHAN,
      }),
      makeTask({
        key: "T-48",
        title: "Playtest with two clubs",
        status: "todo",
        owner: AISHA,
      }),
    ],
  }),
  waitsOn: [],
  blocks: [
    linkedFeature({
      key: "T-60",
      title: "Season leaderboard",
      status: "todo",
      owner: MARIA,
      blocked: true,
    }),
  ],
};
