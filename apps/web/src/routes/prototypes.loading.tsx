import { createFileRoute } from "@tanstack/react-router";
import { LoadingPrototype } from "@/prototypes/loading/loading-prototype";
import {
  type LoadingSearch,
  parseLoadingSearch,
} from "@/prototypes/loading/search";

// Exploration only: nothing in production imports from src/prototypes.
export const Route = createFileRoute("/prototypes/loading")({
  validateSearch: parseLoadingSearch,
  component: LoadingRoute,
});

function LoadingRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LoadingPrototype
      search={search}
      onSearch={(patch) =>
        void navigate({
          search: (prev: LoadingSearch) => ({ ...prev, ...patch }),
          replace: true,
        })
      }
    />
  );
}
