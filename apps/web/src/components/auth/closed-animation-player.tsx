import { Lottie } from "lottie-react";
import { useSyncExternalStore } from "react";
import catSleeping from "@/assets/cat-sleeping.json";

// Asset: "Cat Sleeping" by Haligul Jaman, LottieFiles.
// Source: https://lottiefiles.com/free-animation/cat-sleeping-NePxqG0qqK
// License: Lottie Simple License (free for commercial use).
const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Loaded lazily by ClosedAnimation, so lottie-web and the animation JSON stay
// out of the main bundle.
export default function ClosedAnimationPlayer({
  className,
}: {
  className?: string;
}) {
  const reduceMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return (
    <Lottie
      src={catSleeping}
      loop
      autoplay={!reduceMotion}
      className={className}
    />
  );
}
