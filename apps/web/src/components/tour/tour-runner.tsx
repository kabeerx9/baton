import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useRef } from "react";
import getBoard from "@/fetchers/board/get-board";
import {
  DEMO_TASK_KEYS,
  type DemoTaskKey,
  type TourOutcome,
  type TourStart,
} from "@/fetchers/tour/types";
import { deriveDemoSnapshot } from "./demo-snapshot";
import { FinishBreak } from "./finish-break";
import { TourOverlay } from "./tour-overlay";
import {
  type CloseReason,
  INITIAL_TOUR_STATE,
  type TourSession,
  tourReducer,
} from "./tour-machine";
import { type StepId, STEPS, type StepPage } from "./tour-steps";

/** What the runner needs from the app. The host wires the real ones. */
export type TourEnv = {
  start: () => Promise<TourStart>;
  finish: (outcome: TourOutcome) => Promise<unknown>;
  /** Makes the demo workspace active and opens one of its pages. */
  goTo: (workspaceId: string, page: Exclude<StepPage, null>) => void;
  /** Returns the user to their real workspace and drops demo caches. */
  leaveDemo: (session: TourSession) => void;
  /** The real workspace the tour began in, if known. */
  originWorkspaceId: string | null;
  /** A start or finish call failed; the host shows a message. */
  onError: (kind: "start" | "finish") => void;
  onClosed: (reason: CloseReason) => void;
};

function toSession(
  start: TourStart,
  originWorkspaceId: string | null,
): TourSession | null {
  const ids: Partial<Record<DemoTaskKey, string>> = {};
  for (const task of start.tasks) ids[task.key] = task.id;
  if (!DEMO_TASK_KEYS.every((key) => ids[key])) return null;
  return {
    demoWorkspaceId: start.demoWorkspace.id,
    taskIds: ids as Record<DemoTaskKey, string>,
    originWorkspaceId,
  };
}

/** Hosts the one tour state. Everything the tour does is an effect of it. */
export function TourRunner({ env }: { env: TourEnv }) {
  const [state, dispatch] = useReducer(tourReducer, INITIAL_TOUR_STATE);
  const envRef = useRef(env);
  envRef.current = env;

  const session = "session" in state ? state.session : null;
  const step: StepId | null =
    state.status === "active" || state.status === "confirming-skip"
      ? state.step
      : state.status === "finishing"
        ? state.resume
        : null;
  const watching =
    state.status === "active" || state.status === "confirming-skip";

  // Start once per mount (reload restarts the tour, and `start` resets).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: "START" });
    envRef.current
      .start()
      .then((result) => {
        const next = toSession(result, envRef.current.originWorkspaceId);
        if (next) dispatch({ type: "STARTED", session: next });
        else throw new Error("incomplete demo tasks");
      })
      .catch(() => {
        envRef.current.onError("start");
        dispatch({ type: "START_FAILED" });
      });
  }, []);

  // The demo board in the query cache is the only source of progress.
  const board = useQuery({
    queryKey: ["task-board", session?.demoWorkspaceId],
    queryFn: () => getBoard(session?.demoWorkspaceId ?? ""),
    enabled: watching && session !== null,
    retry: false,
    // Safety net for the interactive step if the move happens off the board.
    refetchInterval: step === "move-task" ? 4000 : false,
  });
  const snapshot = useMemo(
    () =>
      session
        ? deriveDemoSnapshot(
            { data: board.data, error: board.error },
            session.taskIds,
          )
        : null,
    [session, board.data, board.error],
  );
  useEffect(() => {
    if (snapshot && watching) dispatch({ type: "DATA", snapshot });
  }, [snapshot, watching]);

  // Open the page each step lives on.
  const demoId = session?.demoWorkspaceId;
  useEffect(() => {
    if (!step || !demoId) return;
    const page = STEPS[step].page;
    if (page) envRef.current.goTo(demoId, page);
  }, [step, demoId]);

  // Finish or skip: one call, guarded against a double run.
  const finishing = useRef(false);
  const outcome = state.status === "finishing" ? state.outcome : null;
  useEffect(() => {
    if (!outcome || !session || finishing.current) return;
    finishing.current = true;
    envRef.current
      .finish(outcome)
      .then(() => {
        // A skip is quiet: leave the demo now. A finish waits for the
        // animation to cover the screen.
        if (outcome === "skipped") envRef.current.leaveDemo(session);
        dispatch({ type: "FINISH_OK" });
      })
      .catch(() => {
        envRef.current.onError("finish");
        dispatch({ type: "FINISH_FAILED" });
      })
      .finally(() => {
        finishing.current = false;
      });
  }, [outcome, session]);

  // Escape asks to skip, and Escape again goes back to the tour.
  useEffect(() => {
    if (!watching) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dispatch({
        type: state.status === "active" ? "SKIP_ASK" : "SKIP_CANCEL",
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [watching, state.status]);

  const closedReason = state.status === "closed" ? state.reason : null;
  useEffect(() => {
    if (closedReason) envRef.current.onClosed(closedReason);
  }, [closedReason]);

  if (state.status === "breaking") {
    return (
      <FinishBreak
        onCovered={() => envRef.current.leaveDemo(state.session)}
        onDone={() => dispatch({ type: "BREAK_DONE" })}
      />
    );
  }
  if (!step || !session) return null;
  return (
    <TourOverlay
      step={step}
      taskIds={session.taskIds}
      confirmingSkip={state.status === "confirming-skip"}
      busy={state.status === "finishing"}
      onNext={() => dispatch({ type: "NEXT" })}
      onFinish={() => dispatch({ type: "FINISH" })}
      onSkipAsk={() => dispatch({ type: "SKIP_ASK" })}
      onSkipCancel={() => dispatch({ type: "SKIP_CANCEL" })}
      onSkipConfirm={() => dispatch({ type: "SKIP_CONFIRM" })}
    />
  );
}
