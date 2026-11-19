import { AISHA, KABEER, ROHAN } from "./people";
import { makeFeature, makeTask } from "./make-task";
import type { Scenario } from "./scenario-types";

export const FRESH: Scenario = {
  id: "fresh",
  label: "Not started · 4 tasks",
  feature: makeFeature({
    key: "T-62",
    title: "Season leaderboard",
    summary: "Rank clubs across a season.",
    owner: KABEER,
    subtasks: [
      makeTask({
        key: "API-40",
        title: "Season points query",
        status: "todo",
        owner: ROHAN,
      }),
      makeTask({
        key: "WEB-60",
        title: "Leaderboard table",
        status: "todo",
        owner: KABEER,
      }),
      makeTask({
        key: "WEB-61",
        title: "Season picker",
        status: "todo",
        owner: KABEER,
      }),
      makeTask({
        key: "T-63",
        title: "Agree tie-break wording with clubs",
        status: "todo",
        owner: AISHA,
      }),
    ],
  }),
  waitsOn: [],
  blocks: [],
};
