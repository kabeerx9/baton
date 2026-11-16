import { expect, it } from "vite-plus/test";
import { withTaskKeys } from "./task-keys.js";

it("adds the spoken key to each assigned task", () => {
  expect(
    withTaskKeys({
      total: 2,
      tasks: [
        { id: "a", projectSlug: "T", number: 5 },
        { id: "b", projectSlug: "API", number: null },
      ],
    }),
  ).toEqual({
    total: 2,
    tasks: [
      { key: "T-5", id: "a", projectSlug: "T", number: 5 },
      { key: "API-?", id: "b", projectSlug: "API", number: null },
    ],
  });
  expect(withTaskKeys({ error: "x" })).toEqual({ error: "x" });
});
