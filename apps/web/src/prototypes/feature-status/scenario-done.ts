import { AISHA, KABEER, ROHAN } from "./people";
import { makeFeature, makeTask } from "./make-task";
import type { Scenario } from "./scenario-types";

export const DONE: Scenario = {
  id: "done",
  label: "All done · 5 tasks",
  feature: makeFeature({
    key: "T-37",
    title: "Onboarding checklist",
    summary: "New clubs finish setup in one pass.",
    owner: KABEER,
    subtasks: [
      makeTask({
        key: "WEB-30",
        title: "Checklist card",
        status: "done",
        owner: KABEER,
      }),
      makeTask({
        key: "WEB-31",
        title: "Step completion animation",
        status: "done",
        owner: KABEER,
      }),
      makeTask({
        key: "API-24",
        title: "Setup progress endpoint",
        status: "done",
        owner: ROHAN,
      }),
      makeTask({
        key: "API-25",
        title: "Backfill progress for old clubs",
        status: "done",
        owner: ROHAN,
      }),
      makeTask({
        key: "T-39",
        title: "Write the setup help page",
        status: "done",
        owner: AISHA,
      }),
    ],
  }),
  waitsOn: [],
  blocks: [],
};
