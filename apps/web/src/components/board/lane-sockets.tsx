import { useProjectWebSocket } from "@/hooks/use-project-websocket";

function LaneSocket({ projectId }: { projectId: string }) {
  useProjectWebSocket(projectId);
  return null;
}

/** Keeps the board live: one socket per project the board draws from. */
export function LaneSockets({ projectIds }: { projectIds: string[] }) {
  return (
    <>
      {projectIds.map((id) => (
        <LaneSocket key={id} projectId={id} />
      ))}
    </>
  );
}
