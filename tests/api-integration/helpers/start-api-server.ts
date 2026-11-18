// Starts the API as production does, in a child process: `startServer` runs
// the migrations and exits non-zero when they fail.
import { createApp, startServer } from "../../../apps/api/src/index";

await startServer(createApp().injectWebSocket, Number(process.env.PORT ?? 0));
