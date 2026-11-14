import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";

export const integrationPlugins = [githubPlugin];

export function initializePlugins() {
  console.log("Initializing plugins...");

  for (const plugin of integrationPlugins) {
    registerPlugin(plugin);
  }
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
