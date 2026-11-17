import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { BoardDayRollover } from "@/components/board/board-day-rollover";
import CommandPalette from "@/components/command-palette";
import SearchCommandMenu from "@/components/search-command-menu";
import { StatusRequestModal } from "@/components/task/change-request/status-request-modal";

// layout for the main app
export const Route = createFileRoute("/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { workspaceId } = useParams({ strict: false });
  return (
    <>
      <Outlet />
      <CommandPalette />
      <StatusRequestModal workspaceId={workspaceId} />
      <BoardDayRollover />
      <SearchCommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </>
  );
}
