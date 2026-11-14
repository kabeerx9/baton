#!/usr/bin/env node
import { runCli } from "./cli.js";
import { MissingApiKeyError } from "./server-config.js";

runCli().catch((err: unknown) => {
  console.error(err instanceof MissingApiKeyError ? err.message : err);
  process.exit(1);
});
