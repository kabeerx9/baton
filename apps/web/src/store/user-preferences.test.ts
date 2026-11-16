import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

describe("theme preference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => localStorage.clear());

  it("defaults to light when nothing is stored", async () => {
    const { useUserPreferencesStore } = await import("./user-preferences");
    expect(useUserPreferencesStore.getState().theme).toBe("light");
  });

  it.each(["dark", "system"] as const)(
    "keeps a stored %s choice",
    async (theme) => {
      localStorage.setItem(
        "user-preferences",
        JSON.stringify({ state: { theme }, version: 0 }),
      );
      const { useUserPreferencesStore } = await import("./user-preferences");
      expect(useUserPreferencesStore.getState().theme).toBe(theme);
    },
  );
});
