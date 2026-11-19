import { createContext, type ReactNode, useContext } from "react";

const InShellContext = createContext(false);

/**
 * Wraps the content pane of an app shell (sidebar already mounted). Anything
 * that renders inside it, such as the router's pending screen for a child
 * route, knows a full-screen splash would be a second screen beside the sidebar.
 */
export function InShell({ children }: { children: ReactNode }) {
  return <InShellContext value={true}>{children}</InShellContext>;
}

export function useInShell(): boolean {
  return useContext(InShellContext);
}
