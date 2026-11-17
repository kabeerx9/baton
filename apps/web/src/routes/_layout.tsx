import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import CommandPalette from "@/components/command-palette";
import SearchCommandMenu from "@/components/search-command-menu";
import { StatusRequestModal } from "@/components/task/change-request/status-request-modal";

// layout for the main app
export const Route = createFileRoute("/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <Outlet />
      <CommandPalette />
      <StatusRequestModal />
      <SearchCommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </>
  );
}
