import { describe, expect, it } from "vite-plus/test";
import { filterEnabledIntegrations } from "./filter-enabled-integrations";
import type { IntegrationDefinition } from "./integration-definitions";

const github = { id: "github" } as IntegrationDefinition;

describe("filterEnabledIntegrations", () => {
  it("drops a provider the administrator turned off", () => {
    expect(filterEnabledIntegrations([github], ["github"])).toEqual([]);
    expect(filterEnabledIntegrations([github], [])).toEqual([github]);
  });

  it("keeps a saved connection removable even when its provider is off", () => {
    for (const state of ["connected", "paused"] as const) {
      expect(
        filterEnabledIntegrations([github], ["github"], { github: { state } }),
      ).toEqual([github]);
    }
    expect(
      filterEnabledIntegrations([github], ["github"], {
        github: { state: "disconnected" },
      }),
    ).toEqual([]);
  });
});
