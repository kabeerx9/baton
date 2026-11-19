import { useLocation } from "@tanstack/react-router";
import { useInShell } from "../in-shell";
import { ContentPending } from "../pending/content-pending";
import { SplashScreen } from "./splash-screen";
import { splashStepForPath } from "./splash-step";

/**
 * The router's pending screen; the router sets the delay and minimum time.
 * Where it renders decides what it shows: inside an app shell it is a small
 * spinner in the content pane, otherwise (nothing mounted) the full splash.
 */
export function PendingSplash() {
  const inShell = useInShell();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (inShell) return <ContentPending />;
  return <SplashScreen step={splashStepForPath(pathname)} />;
}
