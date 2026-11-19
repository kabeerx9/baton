import { useLocation } from "@tanstack/react-router";
import { SplashScreen } from "./splash-screen";
import { splashStepForPath } from "./splash-step";

/** The router's pending screen. The router sets the delay and minimum time. */
export function PendingSplash() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return <SplashScreen step={splashStepForPath(pathname)} />;
}
