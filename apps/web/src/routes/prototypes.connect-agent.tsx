import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ConnectAgentPrototype } from "@/prototypes/connect-agent/connect-agent-prototype";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { SCENARIOS, type Scenario } from "@/prototypes/connect-agent/types";

type PrototypeSearch = { v: number; s: Scenario; t?: "light" | "dark" };

// Exploration only. Nothing in production imports this route.
export const Route = createFileRoute("/prototypes/connect-agent")({
  validateSearch: (search: Record<string, unknown>): PrototypeSearch => {
    const v = Number(search.v);
    const s = SCENARIOS.find((x) => x.id === search.s)?.id ?? "normal";
    const t =
      search.t === "light" || search.t === "dark" ? search.t : undefined;
    return { v: v >= 1 && v <= 3 ? v : 1, s, t };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { v, s, t } = Route.useSearch();
  const navigate = Route.useNavigate();

  // `?t=light|dark` sets the theme, so a screenshot run can pick one by URL.
  useEffect(() => {
    if (t) useUserPreferencesStore.setState({ theme: t });
  }, [t]);

  return (
    <div className="h-svh w-full overflow-hidden">
      <ConnectAgentPrototype
        variant={v - 1}
        scenario={s}
        onVariant={(index) =>
          navigate({ search: { v: index + 1, s, t }, replace: true })
        }
        onScenario={(scenario) =>
          navigate({ search: { v, s: scenario, t }, replace: true })
        }
      />
    </div>
  );
}
