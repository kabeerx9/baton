import "./instrument";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, useTranslation } from "react-i18next";
import queryClient from "@/query-client";
import { watchTaskReads } from "@/store/task-status/watch-reads";
import "@/index.css";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { SequenceHint } from "./components/shortcuts/sequence-hint";
import { ShortcutsPanel } from "./components/shortcuts/shortcuts-panel";
import { PendingSplash } from "./components/common/splash/pending-splash";
import AuthProvider from "./components/providers/auth-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ShortcutListener } from "./lib/shortcuts/shortcut-listener";
import { takeBootSplashShown } from "./lib/boot-splash";
import { preloadRouteComponents } from "./lib/preload-route-components";
import { i18n } from "./lib/i18n";
import { routeTree } from "./routeTree.gen";

console.log(`
                     ////////  
              /////  ////////  
            //////// ////////  
  //////// ///////// ///////   
  //////// ///////// //////    
  //////// ///////// ////      
  //////// ///////// ///       
  //////// ///////// /////     
  //////// ///////// //////    
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ////////            
  ////////  /////              
  ///////                      
                   
  
  Project management that doesn't become the project.
`);

// One listener for the app: a read of a task ends its "uncertain" status write.
watchTaskReads(queryClient);

const PENDING_MS = 300;

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  // Show the splash after 300ms of waiting, and keep it at least 500ms.
  defaultPendingComponent: PendingSplash,
  defaultPendingMs: PENDING_MS,
  defaultPendingMinMs: 500,
  context: {
    user: null,
    queryClient,
  },
});

preloadRouteComponents(router, window.location.pathname);

function App() {
  const { user } = useAuth();
  // Runs once, before the router mounts and starts its first load.
  useState(() => {
    if (!takeBootSplashShown()) return;
    router.update({ ...router.options, defaultPendingMs: 0 });
    const stop = router.subscribe("onResolved", () => {
      router.update({ ...router.options, defaultPendingMs: PENDING_MS });
      stop();
    });
  });

  return <RouterProvider router={router} context={{ user }} />;
}

// Root boundary fallback: shows a generic message and a refresh button,
// without rendering the raw error.message. The full error is still
// captured to Sentry by the boundary itself.
function RootCrashFallback({
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("common:error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common:error.description")}
        </p>
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("common:error.refreshPage")}
        </button>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary fallback={RootCrashFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <I18nextProvider i18n={i18n}>
                <ShortcutListener />
                <App />
                <ShortcutsPanel />
                <SequenceHint />
              </I18nextProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
