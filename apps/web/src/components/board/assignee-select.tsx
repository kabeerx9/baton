import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";

const UNASSIGNED = "__none";

/** Picks a workspace member, or nobody. `value` is a user id or undefined. */
export function AssigneeSelect({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value: string | undefined;
  onChange: (userId: string | undefined) => void;
}) {
  const { data: members = [] } = useGetWorkspaceUsers(workspaceId);
  const member = members.find((m) => m.id === value);
  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) =>
        typeof v === "string" && onChange(v === UNASSIGNED ? undefined : v)
      }
    >
      <SelectTrigger aria-label="Assignee">
        <SelectValue>{member ? member.name : "Unassigned"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
