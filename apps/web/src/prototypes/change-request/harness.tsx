import { useCallback, useState } from "react";
import { ProtoPicker } from "./proto-picker";
import { ScenarioControls } from "./scenario-controls";
import { TaskShell } from "./task-shell";
import { useSimulation } from "./use-simulation";
import { VariantBanner } from "./variant-banner";
import { VariantChip } from "./variant-chip";
import { ThreadStatusHint, VariantThread } from "./variant-thread";

const NAMES = ["Banner", "Chip", "Thread"];

function readVariant(): number {
  const requested = Number.parseInt(
    new URLSearchParams(window.location.search).get("v") ?? "",
    10,
  );
  return requested >= 1 && requested <= NAMES.length ? requested - 1 : 0;
}

/** Prototype only: one variant at a time, full size, on a stand-in task page. */
export function ChangeRequestHarness() {
  const sim = useSimulation();
  const [active, setActive] = useState(readVariant);
  // A new key re-mounts the variant so entrance motion runs again.
  const [mountKey, setMountKey] = useState(0);

  const select = useCallback((index: number) => {
    setActive(index);
    setMountKey((key) => key + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(index + 1));
    window.history.replaceState(null, "", url);
  }, []);
  const replay = useCallback(() => setMountKey((key) => key + 1), []);

  const panel = {
    request: sim.request,
    viewer: sim.scenario.viewer,
    phase: sim.phase,
    now: sim.now,
    onAction: sim.act,
    onDismiss: sim.dismiss,
  };
  const applied =
    sim.phase.kind === "resolved" &&
    sim.phase.action === "accept" &&
    sim.request.kind === "status";
  const statusSlug = applied
    ? (sim.request.targetStatus ?? "doing")
    : sim.request.baseStatus;

  return (
    <div className="h-svh w-full overflow-y-auto bg-background">
      <TaskShell
        activityTail={
          active === 2 ? <VariantThread key={mountKey} {...panel} /> : undefined
        }
        aboveDescription={
          active === 0 ? <VariantBanner key={mountKey} {...panel} /> : undefined
        }
        headerSlot={
          active === 1 ? <VariantChip key={mountKey} {...panel} /> : undefined
        }
        statusHint={
          active === 2 ? (
            <ThreadStatusHint phase={sim.phase} request={sim.request} />
          ) : undefined
        }
        statusSlug={statusSlug}
      />
      <ScenarioControls
        onChange={sim.setScenario}
        onReset={sim.reset}
        scenario={sim.scenario}
      />
      <ProtoPicker
        active={active}
        names={NAMES}
        onChange={select}
        onReplay={replay}
      />
    </div>
  );
}
