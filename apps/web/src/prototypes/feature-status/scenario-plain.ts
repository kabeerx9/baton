import { KABEER } from "./people";
import { makeFeature } from "./make-task";
import { linkedFeature, type Scenario } from "./scenario-types";

/** A task with nothing under it: today's hero stays as it is. */
export const PLAIN: Scenario = {
  id: "plain",
  label: "Plain task",
  feature: makeFeature({
    key: "WEB-7",
    title: "Fix the Safari login crash",
    summary: "",
    owner: KABEER,
    subtasks: [],
  }),
  waitsOn: [],
  blocks: [
    linkedFeature({
      key: "T-71",
      title: "Release 1.4",
      status: "doing",
      owner: KABEER,
      blocked: true,
    }),
  ],
};
