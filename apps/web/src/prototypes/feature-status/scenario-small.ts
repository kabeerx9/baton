import { AISHA, KABEER } from "./people";
import { makeFeature, makeTask } from "./make-task";
import type { Scenario } from "./scenario-types";

export const SMALL: Scenario = {
  id: "small",
  label: "Small feature · 2 tasks",
  feature: makeFeature({
    key: "T-44",
    title: "Invite links",
    summary: "Join a club from a link.",
    owner: KABEER,
    subtasks: [
      makeTask({
        key: "WEB-12",
        title: "Join page",
        status: "doing",
        owner: KABEER,
      }),
      makeTask({
        key: "API-9",
        title: "Invite token endpoint",
        status: "doing",
        owner: AISHA,
      }),
    ],
  }),
  waitsOn: [],
  blocks: [],
};
