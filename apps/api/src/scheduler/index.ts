import { retryStorageCleanup } from "../storage/cleanup-queue";
import { cleanupDemoWorkspaces } from "./demo-workspace-cleanup";
import { cleanupDraftUploads } from "./draft-upload-cleanup";
import { replayDeferredIssueEdits } from "../plugins/github/services/deferred-issue-edits";
import { replayDeferredLabelFields } from "../plugins/sync/replay-deferred-label-fields";
import * as Sentry from "@sentry/node";
import { Cron } from "croner";
import { runDetached } from "../observability/background-context";
import { addDomainBreadcrumb } from "../observability/domain-event";
import { logger } from "../observability/logger";
import { checkDueDateReminders } from "./due-date-reminders";
import { digestConfigWarnings, slackConfig } from "../slack-dm/config";
import { sendDueDigests } from "../slack-dm/digest";
import { expireChangeRequests } from "../task-change-request/expire-change-requests";
import { checkOutboxHealth } from "../events/outbox/health";
import { pruneOutbox } from "../events/outbox/prune";

const jobs: Cron[] = [];

type JobOutcome = { degraded?: boolean };

// Cron jobs swallow their operational failures (per-item try/catch) so they
// can keep processing the rest of the batch. Reporting Sentry status purely
// from the thrown-rejection channel would always show "ok" for any partially
// failed run. Inspect the returned outcome instead so handled failures light
// up the monitor without aborting the rest of the work. Unexpected throws are
// captured as exception events and swallowed so one bad tick can't take down
// the scheduler via an unhandled rejection.
function withCheckIn<T>(name: string, fn: () => Promise<T>) {
  // Each run gets its own empty context, so its breadcrumbs stay with its
  // errors and no request's user or workspace leaks in.
  return () => runDetached(() => runJob(name, fn));
}

async function runJob<T>(name: string, fn: () => Promise<T>): Promise<void> {
  const started = performance.now();
  addDomainBreadcrumb("cron", "Cron job started", { job: name });
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: name,
    status: "in_progress",
  });
  try {
    const result = await fn();
    const degraded = Boolean(
      (result as JobOutcome | null | undefined)?.degraded,
    );
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: name,
      status: degraded ? "error" : "ok",
    });
    const facts = {
      job: name,
      outcome: degraded ? "degraded" : "ok",
      duration_ms: Math.round(performance.now() - started),
    };
    addDomainBreadcrumb("cron", "Cron job finished", facts);
    // Healthy runs stay on stdout; check-ins already show them in Sentry.
    if (degraded) logger.warn("Cron job finished degraded", facts);
    else logger.info("Cron job finished", facts);
  } catch (error) {
    Sentry.captureException(error, { tags: { area: "cron", job: name } });
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: name,
      status: "error",
    });
    // Sentry marks the captured error, so this line adds no second event.
    logger.error("Cron job failed", { job: name, error });
  }
}

export function initializeScheduler(): void {
  jobs.push(
    new Cron(
      "* * * * *",
      withCheckIn("deferred-issue-edits", replayDeferredIssueEdits),
    ),
  );
  jobs.push(
    new Cron(
      "* * * * *",
      { protect: true },
      withCheckIn("deferred-label-fields", replayDeferredLabelFields),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      { protect: true },
      withCheckIn("storage-cleanup", retryStorageCleanup),
    ),
  );
  jobs.push(
    new Cron(
      "31 * * * *",
      { protect: true },
      withCheckIn("draft-upload-cleanup", cleanupDraftUploads),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("due-date-reminders", checkDueDateReminders),
    ),
  );
  // Unanswered change requests apply or expire 24 hours after they were made.
  jobs.push(
    new Cron(
      "17 * * * *",
      { protect: true },
      withCheckIn("task-change-request-timeouts", expireChangeRequests),
    ),
  );
  // A due row unclaimed for 5 minutes, or a new dead row, is degraded.
  jobs.push(
    new Cron(
      "*/5 * * * *",
      { protect: true },
      withCheckIn("outbox-health", checkOutboxHealth),
    ),
  );
  // Dead outbox rows are kept 30 days for diagnosis.
  jobs.push(
    new Cron(
      "43 * * * *",
      { protect: true },
      withCheckIn("outbox-prune", pruneOutbox),
    ),
  );
  // Demo workspaces from abandoned product tours are removed after 7 days.
  jobs.push(
    new Cron(
      "23 * * * *",
      { protect: true },
      withCheckIn("demo-workspace-cleanup", () => cleanupDemoWorkspaces()),
    ),
  );
  // The Slack digest exists only when a bot token is set. Every real UTC
  // offset is a multiple of 15 minutes, so each person's send time lands on a
  // tick; sendDueDigests decides who is due in their own zone.
  if (slackConfig()) {
    for (const warning of digestConfigWarnings()) {
      logger.warn(`[slack-dm] ${warning}`);
    }
    jobs.push(
      new Cron(
        "*/15 * * * *",
        { protect: true },
        withCheckIn("slack-morning-digest", sendDueDigests),
      ),
    );
  }
  logger.info(
    "⏰ Scheduler started (deferred integration edits every minute, reminders every 5 minutes)",
  );
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
