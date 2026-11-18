import { defineConfig } from "vite-plus";
import integration from "../../../apps/api/vitest.integration.config";

// Runs only the recorder; never part of `pnpm test:integration`. A plain
// spread, because `mergeConfig` would append to `include`.
export default defineConfig({
  ...integration,
  test: {
    ...integration.test,
    include: ["../../tests/fixtures/api-keys/record-plugin-api-keys.ts"],
  },
});
