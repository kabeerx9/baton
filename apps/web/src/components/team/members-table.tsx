import { DEFAULT_ROLE_NAMES } from "@baton/permissions";
import {
  EllipsisIcon,
  PencilIcon,
  ShieldIcon,
  TrashIcon,
  UserMinusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import useUpdateWorkspaceUserRole from "@/hooks/mutations/workspace-user/use-update-workspace-user-role";
import useWorkspaceRoles from "@/hooks/queries/workspace/use-workspace-roles";
import useGetMyProjectAccess from "@/hooks/queries/workspace-users/use-get-my-project-access";
import useGetWorkspaceProjectAccess from "@/hooks/queries/workspace-users/use-get-workspace-project-access";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import type { WorkspaceUser } from "@/types/workspace-user";
import { useAuth } from "../providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import MemberProjectAccessDialog from "./member-project-access-dialog";
import {
  ALL_PROJECTS_ACCESS,
  type ProjectAccessValue,
} from "./project-access/project-access-value";
import { findMemberProjectAccess } from "./project-access/find-member-project-access";
import { workspaceWriteErrorMessage } from "@/lib/workspace-write-error-message";

type Props = {
  workspaceId: string;
  users: WorkspaceUser[];
};

// Stable per-user pastel for the avatar fallback. Picks one of a curated set
// of Tailwind tone pairs from a cheap string hash so the same user keeps the
// same color across re-renders without server-side state.
const AVATAR_TONES = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
] as const;

// Names that are NOT "truly custom": viewer/member/admin are seeded as
// editable workspace_role rows on every workspace creation, and owner is a
// static built-in. The Select already lists them as built-ins, so we filter
// them out of the custom-roles tail to avoid duplicate options.
const RESERVED_ROLE_NAMES = new Set<string>([...DEFAULT_ROLE_NAMES, "owner"]);

function toneFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MembersTable({ workspaceId, users }: Props) {
  const { t } = useTranslation();
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceUser | null>(
    null,
  );
  const [accessTarget, setAccessTarget] = useState<{
    userId: string;
    name: string;
    access: ProjectAccessValue;
  } | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

  const { user: currentUser } = useAuth();
  const { mutateAsync: deleteWorkspaceUser, isPending: isDeleting } =
    useDeleteWorkspaceUser();
  const {
    mutateAsync: updateMemberRole,
    isPending: isUpdatingRole,
    variables: roleUpdate,
  } = useUpdateWorkspaceUserRole();
  const { data: allWorkspaceRoles = [] } = useWorkspaceRoles(workspaceId);
  const { canManageTeam, canUpdateMembers, canRemoveMembers } =
    useWorkspacePermission();
  const canChangeRoles = Boolean(canManageTeam());
  const canManageProjectAccess = Boolean(canUpdateMembers());
  const canRemove = Boolean(canRemoveMembers());
  const { data: projectAccessEntries } = useGetWorkspaceProjectAccess(
    workspaceId,
    canManageProjectAccess,
  );
  const { data: myAccess } = useGetMyProjectAccess(
    workspaceId,
    canManageProjectAccess,
  );
  const managerLimited = myAccess?.projectAccess === "selected";
  const columnCount = canManageProjectAccess ? 5 : 4;

  const describeAccess = (access: ProjectAccessValue) =>
    access.projectAccess === "all"
      ? t("team:projectAccess.allProjects")
      : t("team:projectAccess.projectCount", {
          count: access.projectIds.length,
        });

  const customRoles = allWorkspaceRoles.filter(
    (role) => !RESERVED_ROLE_NAMES.has(role.role),
  );

  // Owner first, then everyone else (stable on ties so the original
  // listMembers order is preserved within each group).
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === b.role) return 0;
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return 0;
  });

  const handleChangeRole = async (member: WorkspaceUser, role: string) => {
    if (role === member.role) return;
    try {
      await updateMemberRole({ workspaceId, userId: member.id, role });
      toast.success(t("team:membersTable.roleUpdateSuccess"), {
        icon: ShieldCheckIcon,
      });
    } catch (error) {
      toast.error(
        workspaceWriteErrorMessage(
          error,
          t("team:membersTable.roleUpdateError"),
        ),
      );
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      await deleteWorkspaceUser({
        workspaceId,
        userId: memberToDelete.id,
      });
      toast.success(t("team:membersTable.removeSuccess"), {
        icon: UserMinusIcon,
      });
    } catch (error) {
      toast.error(
        workspaceWriteErrorMessage(error, t("team:membersTable.removeError")),
      );
    } finally {
      setMemberToDelete(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6 text-foreground font-medium">
              {t("team:membersTable.columns.name", {
                defaultValue: "Member",
              })}
            </TableHead>
            <TableHead className="text-foreground font-medium">
              {t("team:membersTable.columns.role", { defaultValue: "Role" })}
            </TableHead>
            {canManageProjectAccess ? (
              <TableHead className="text-foreground font-medium">
                {t("team:membersTable.columns.projects")}
              </TableHead>
            ) : null}
            <TableHead className="text-foreground font-medium">
              {t("team:membersTable.columns.joined", {
                defaultValue: "Joined",
              })}
            </TableHead>
            <TableHead className="w-px pe-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedUsers.map((member) => {
            const isSelf = currentUser?.id === member.id;
            const showRoleSelect =
              canChangeRoles && !isSelf && member.role !== "owner";
            const access =
              member.role === "owner"
                ? ALL_PROJECTS_ACCESS
                : findMemberProjectAccess(projectAccessEntries, member.id);
            const showAccessEdit =
              canManageProjectAccess &&
              !isSelf &&
              member.role !== "owner" &&
              !(managerLimited && access.projectAccess === "all");
            const accessLabel = describeAccess(access);
            const memberName = member.name || member.email;
            const tone = toneFor(member.email);
            return (
              <TableRow key={member.email}>
                <TableCell className="ps-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className={cn("size-8", tone)}>
                      <AvatarImage
                        src={member.image ?? ""}
                        alt={member.name ?? ""}
                      />
                      <AvatarFallback className="bg-transparent text-[11px] font-medium">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Capped on phones so the email truncates and the role column
                        peeks in, hinting that the table scrolls sideways. */}
                    <div className="min-w-0 max-w-[55vw] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {member.name}
                        </span>
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">
                            ({t("team:members.you", { defaultValue: "You" })})
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {member.role === "owner" ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldIcon className="size-3" />
                      {t("team:roles.owner", { defaultValue: "Owner" })}
                    </Badge>
                  ) : showRoleSelect ? (
                    <Select
                      value={member.role}
                      disabled={
                        isUpdatingRole && roleUpdate?.userId === member.id
                      }
                      onValueChange={(value) => {
                        if (typeof value === "string" && value) {
                          handleChangeRole(member, value);
                        }
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-8 w-32"
                        aria-label={t("team:membersTable.roleSelectAria", {
                          name: memberName,
                        })}
                      >
                        <SelectValue>
                          {t(`team:roles.${member.role}`, {
                            defaultValue: capitalize(member.role),
                          })}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          {t("team:roles.viewer", { defaultValue: "Viewer" })}
                        </SelectItem>
                        <SelectItem value="member">
                          {t("team:roles.member", { defaultValue: "Member" })}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t("team:roles.admin", { defaultValue: "Admin" })}
                        </SelectItem>
                        {/* Owner is not offered: the role route refuses it.
                            Ownership moves only by the transfer in workspace
                            settings. */}
                        {customRoles.map((r) => (
                          <SelectItem key={r.id} value={r.role}>
                            {capitalize(r.role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {t(`team:roles.${member.role}`, {
                        defaultValue: capitalize(member.role),
                      })}
                    </Badge>
                  )}
                </TableCell>
                {canManageProjectAccess ? (
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {!projectAccessEntries ? (
                      "–"
                    ) : showAccessEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-muted-foreground"
                        aria-label={t("team:projectAccess.editAria", {
                          name: memberName,
                          access: accessLabel,
                        })}
                        onClick={() => {
                          setAccessTarget({
                            userId: member.id,
                            name: memberName,
                            access,
                          });
                          setIsAccessDialogOpen(true);
                        }}
                      >
                        {accessLabel}
                        <PencilIcon className="size-3" />
                      </Button>
                    ) : (
                      accessLabel
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                  {member.joinedAt ? formatDateMedium(member.joinedAt) : "–"}
                </TableCell>
                <TableCell className="pe-6 py-3 text-right">
                  {!isSelf && canRemove ? (
                    <Menu>
                      <MenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={t("team:membersTable.ariaRemoveMember")}
                          />
                        }
                      >
                        <EllipsisIcon className="size-4" />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem onClick={() => setMemberToDelete(member)}>
                          <TrashIcon className="size-4" />
                          {t("team:membersTable.removeMember")}
                        </MenuItem>
                      </MenuPopup>
                    </Menu>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}

          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <p className="text-sm font-medium text-foreground">
                    {t("team:membersTable.emptyTitle")}
                  </p>
                  <p className="text-xs">
                    {t("team:membersTable.emptyDescription")}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <MemberProjectAccessDialog
        workspaceId={workspaceId}
        open={isAccessDialogOpen}
        member={accessTarget}
        access={accessTarget?.access ?? ALL_PROJECTS_ACCESS}
        onOpenChange={setIsAccessDialogOpen}
      />

      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("team:membersTable.removeDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("team:membersTable.removeDialogDescription", {
                name: memberToDelete?.name || memberToDelete?.email || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={
                <Button variant="outline" size="sm" disabled={isDeleting} />
              }
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDeleteMember}
                />
              }
            >
              <TrashIcon className="mr-2 size-4" />
              {t("team:membersTable.removeMember")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MembersTable;
