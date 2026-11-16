import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  TaskDetailPrototype,
  type PrototypeSearch,
} from "@/components/prototypes/task-detail/task-detail-prototype";

// Prototype surface for the task detail screen. Outside auth, no API calls.
export const Route = createFileRoute("/prototypes/task-detail")({
  validateSearch: (search: Record<string, unknown>): PrototypeSearch => ({
    v: Number(search.v) >= 1 ? Math.floor(Number(search.v)) : 1,
    d: search.d === "b" || search.d === "busy" ? search.d : "a",
    u: search.u === "member" ? "member" : "me",
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <TaskDetailPrototype
      search={search}
      onSearch={(next) =>
        void navigate({
          to: "/prototypes/task-detail",
          search: { ...search, ...next },
          replace: true,
        })
      }
    />
  );
}
