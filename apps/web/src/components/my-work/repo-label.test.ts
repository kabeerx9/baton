import { describe, expect, it } from "vite-plus/test";
import { repoLabel } from "./repo-label";

describe("repoLabel", () => {
  it("shows No repo for the hidden board project, not its name", () => {
    expect(repoLabel({ id: "b", name: "Board" }, "b", "No repo")).toBe(
      "No repo",
    );
  });

  it("shows the repo name for any other project", () => {
    expect(repoLabel({ id: "a", name: "API" }, "b", "No repo")).toBe("API");
  });

  it("shows nothing while the board project is unknown", () => {
    expect(repoLabel({ id: "b", name: "Board" }, undefined, "No repo")).toBe(
      "",
    );
  });
});
