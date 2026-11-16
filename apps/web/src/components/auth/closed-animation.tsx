import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const ClosedAnimationPlayer = lazy(() => import("./closed-animation-player"));

export function ClosedAnimation({ className }: { className?: string }) {
  const { t } = useTranslation();
  // The box keeps its size while the chunk loads, so the page does not jump.
  return (
    <div
      role="img"
      aria-label={t("auth:signUp.closed.animationLabel")}
      className={cn("aspect-[556/350] w-full", className)}
    >
      <Suspense fallback={null}>
        <ClosedAnimationPlayer />
      </Suspense>
    </div>
  );
}
