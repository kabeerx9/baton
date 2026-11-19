import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";
import { logger } from "../observability/logger";

export const integrationPlugins = [githubPlugin];

export function initializePlugins() {
  logger.info("Initializing plugins...");

  for (const plugin of integrationPlugins) {
    registerPlugin(plugin);
  }
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  logger.info("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
