import * as React from "react";
import { INITIAL_TASKS, MockBoard, type DemoTask } from "./mock-board";
import { Picker } from "./picker";
import { STEPS, useTargetRect } from "./shared";
import { VariantBeacon } from "./variant-beacon";
import { VariantGuide } from "./variant-guide";
import { VariantSpotlight } from "./variant-spotlight";

const VARIANTS = [
  { name: "Spotlight", Component: VariantSpotlight },
  { name: "Beacon", Component: VariantBeacon },
  { name: "Guide", Component: VariantGuide },
];

function Stage({ variant }: { variant: number }) {
  const [tasks, setTasks] = React.useState<DemoTask[]>(INITIAL_TASKS);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [ended, setEnded] = React.useState(false);
  const step = STEPS[stepIndex];
  const satisfied =
    tasks.find((t) => t.key === "api-endpoint")?.status === "done";
  const rect = useTargetRect(step.target, !ended);
  const { Component } = VARIANTS[variant];
  const move = (key: string) =>
    setTasks((ts) =>
      ts.map((t) => (t.key === key ? { ...t, status: "done" } : t)),
    );
  return (
    <div className="flex h-full w-full">
      <MockBoard tasks={tasks} showTasks={stepIndex >= 1} onMove={move} />
      {ended ? (
        <div className="fixed bottom-4 left-4 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
          Tour ended. Press R to replay.
        </div>
      ) : (
        <Component
          stepIndex={stepIndex}
          rect={rect}
          satisfied={satisfied}
          onNext={() =>
            stepIndex === STEPS.length - 1
              ? setEnded(true)
              : setStepIndex((i) => i + 1)
          }
          onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
          onSkip={() => setEnded(true)}
        />
      )}
    </div>
  );
}

export function TourPrototype() {
  const [variant, setVariant] = React.useState(() => {
    const v = Number.parseInt(
      new URLSearchParams(location.search).get("v") ?? "",
      10,
    );
    return v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
  });
  const [epoch, setEpoch] = React.useState(0);
  const select = React.useCallback((i: number) => {
    setVariant(i);
    setEpoch((e) => e + 1);
    const url = new URL(location.href);
    url.searchParams.set("v", String(i + 1));
    history.replaceState(null, "", url);
  }, []);
  const replay = React.useCallback(() => setEpoch((e) => e + 1), []);
  return (
    <div className="fixed inset-0 bg-background">
      <style>{`
        @keyframes tour-pop{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
        .tour-pop{animation:tour-pop 220ms cubic-bezier(.23,1,.32,1)}
        @keyframes tour-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--primary) 45%,transparent)}100%{box-shadow:0 0 0 12px transparent}}
        .tour-pulse{animation:tour-pulse 1.6s ease-out infinite}
        @media (prefers-reduced-motion:reduce){.tour-pop,.tour-pulse{animation:none}}
      `}</style>
      <Stage key={`${variant}-${epoch}`} variant={variant} />
      <Picker
        names={VARIANTS.map((v) => v.name)}
        current={variant}
        onSelect={select}
        onReplay={replay}
      />
    </div>
  );
}
