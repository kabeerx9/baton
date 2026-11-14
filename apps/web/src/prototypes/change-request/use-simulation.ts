import { useCallback, useEffect, useReducer, useState } from "react";
import {
  type Action,
  type Channel,
  makeRequest,
  type MockRequest,
  phaseReducer,
  type Phase,
  type RequestKind,
  type ServerReply,
  type Viewer,
} from "./model";

export type Scenario = {
  viewer: Viewer;
  kind: RequestKind;
  channel: Channel;
  reply: ServerReply;
};

const LATENCY_MS = 900;

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function readScenario(): Scenario {
  const params = new URLSearchParams(window.location.search);
  return {
    viewer: pick(
      params.get("viewer"),
      ["answerer", "requester", "observer"],
      "answerer",
    ),
    kind: pick(params.get("kind"), ["status", "archive", "delete"], "status"),
    channel: pick(params.get("channel"), ["web", "agent"], "agent"),
    reply: pick(params.get("reply"), ["ok", "decided", "failed", "hang"], "ok"),
  };
}

export type Simulation = {
  scenario: Scenario;
  setScenario: (patch: Partial<Scenario>) => void;
  request: MockRequest;
  phase: Phase;
  now: number;
  act: (action: Action) => void;
  dismiss: () => void;
  reset: () => void;
};

/** Fakes the three change request calls: accept/reject (answerer) and cancel (requester). */
export function useSimulation(): Simulation {
  const [scenario, setScenarioState] = useState(readScenario);
  const [now] = useState(() => Date.now());
  const [phase, dispatch] = useReducer(phaseReducer, { kind: "idle" });
  const request = makeRequest(scenario.kind, scenario.channel, now);

  const setScenario = useCallback((patch: Partial<Scenario>) => {
    setScenarioState((current) => ({ ...current, ...patch }));
    dispatch({ type: "reset" });
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (phase.kind !== "submitting" || scenario.reply === "hang") return;
    // The timeout belongs to the call, not to the phase state.
    const id = window.setTimeout(() => {
      if (scenario.reply === "ok") dispatch({ type: "succeed" });
      else if (scenario.reply === "decided" || scenario.reply === "failed")
        dispatch({ type: "fail", reason: scenario.reply });
    }, LATENCY_MS);
    return () => window.clearTimeout(id);
  }, [phase, scenario.reply]);

  return {
    scenario,
    setScenario,
    request,
    phase,
    now,
    act: (action) => dispatch({ type: "submit", action }),
    dismiss: () => dispatch({ type: "dismiss" }),
    reset: () => dispatch({ type: "reset" }),
  };
}
