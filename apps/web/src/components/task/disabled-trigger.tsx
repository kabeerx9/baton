import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A status control that cannot open: denied by the server, or held by a write
 * that has not settled. The trigger stays in place, muted and marked
 * `aria-disabled`, like the board menu and the status bar. It opens nothing.
 */
export function disabledTrigger(children: ReactNode): ReactNode {
  const only = Children.toArray(children);
  const child = only.length === 1 ? only[0] : null;
  if (!isValidElement<{ className?: string }>(child)) return children;
  return cloneElement(child, {
    "aria-disabled": true,
    className: cn(child.props.className, "cursor-default opacity-60"),
  } as object);
}
