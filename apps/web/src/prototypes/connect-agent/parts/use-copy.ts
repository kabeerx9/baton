import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/copy-to-clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

const RESET_MS = 1800;

/** One status value for the copy lifecycle. The reset timer lives on the call. */
export function useCopy(text: string) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    clearTimeout(timer.current);
    setStatus((await copyToClipboard(text)) ? "copied" : "failed");
    timer.current = setTimeout(() => setStatus("idle"), RESET_MS);
  }, [text]);

  return { status, copy };
}
