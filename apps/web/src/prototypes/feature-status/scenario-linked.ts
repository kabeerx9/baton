import { AISHA, KABEER, MARIA, ROHAN } from "./people";
import { blockerOf, makeFeature, makeTask } from "./make-task";
import { linkedFeature, type Scenario } from "./scenario-types";

const live = linkedFeature({
  key: "T-41",
  title: "Live scoring",
  status: "doing",
  owner: KABEER,
});

/** Waits on one feature and holds up two others. */
export const LINKED: Scenario = {
  id: "linked",
  label: "Linked features",
  feature: makeFeature({
    key: "T-55",
    title: "Match reports",
    summary: "A written report after each match.",
    owner: KABEER,
    waitsOn: [blockerOf(live, KABEER)],
    subtasks: [
      makeTask({
        key: "API-36",
        title: "Report data export",
        status: "done",
        owner: ROHAN,
      }),
      makeTask({
        key: "WEB-50",
        title: "Report page",
        status: "doing",
        owner: KABEER,
      }),
      makeTask({
        key: "ENG-11",
        title: "Highlights from ball-by-ball",
        status: "doing",
        owner: AISHA,
      }),
      makeTask({
        key: "WEB-51",
        title: "Print stylesheet",
        status: "todo",
        owner: KABEER,
      }),
    ],
  }),
  waitsOn: [live],
  blocks: [
    linkedFeature({
      key: "T-62",
      title: "Season leaderboard",
      status: "todo",
      owner: KABEER,
      blocked: true,
    }),
    linkedFeature({
      key: "T-66",
      title: "Club newsletter",
      status: "todo",
      owner: MARIA,
      blocked: true,
    }),
  ],
};
