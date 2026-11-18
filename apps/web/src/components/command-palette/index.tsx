import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { useShortcutsPanelStore } from "@/components/shortcuts/shortcuts-panel-store";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import SearchCommandMenu from "@/components/search-command-menu";
import CreateWorkspaceModal from "@/components/shared/modals/create-workspace-modal";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { ShortcutId } from "@/lib/shortcuts/catalog";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import { useUserPreferencesStore } from "@/store/user-preferences";
import CreateProjectModal from "../shared/modals/create-project-modal";

type PaletteActionItem = {
  value: string;
  label: string;
  shortcutId?: ShortcutId;
  onRun: () => void;
};

type PaletteGroup = {
  value: string;
  label: string;
  items: PaletteActionItem[];
};

function CommandPalette() {
  const { t } = useTranslation();
  const { setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  // The API refuses these to a viewer; the palette and shortcuts offer them
  // only to people who can.
  const { canCreateTasks, canCreateProjects } = useWorkspacePermission();
  const canCreateTask = Boolean(workspace?.id) && canCreateTasks();
  const canCreateProject = canCreateProjects();
  const { data: currentUser } = useCurrentUser();
  const { data: config } = useGetConfig();
  const isAdmin = hasInstanceAdminRole(currentUser?.role);
  const canCreateWorkspace =
    isAdmin || (config !== undefined && !config.disableWorkspaceCreation);
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  const openShortcutsPanel = useShortcutsPanelStore((state) => state.setOpen);

  useShortcut("openCommandMenu", () => setOpen((prev) => !prev));
  useShortcut("createTask", () => setIsCreateTaskOpen(true), {
    enabled: canCreateTask,
  });
  useShortcut("createProject", () => setIsCreateProjectOpen(true), {
    enabled: canCreateProject,
  });

  const runCommand = useCallback((command: () => void) => {
    command();
    setOpen(false);
  }, []);

  const groupedItems = useMemo<PaletteGroup[]>(
    () => [
      {
        value: "suggestions",
        label: t("navigation:commandPalette.suggestions"),
        items: [
          {
            value: "projects",
            label: t("navigation:commandPalette.projects"),
            shortcutId: "goToProjects",
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: "/dashboard/workspace/$workspaceId/projects",
                params: { workspaceId: workspace.id },
              });
            },
          },
          {
            value: "search",
            label: t("navigation:commandPalette.search"),
            shortcutId: "openSearch",
            onRun: () => setIsSearchOpen(true),
          },
          {
            value: "members",
            label: t("navigation:commandPalette.members", {
              defaultValue: "Members",
            }),
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: "/dashboard/workspace/$workspaceId/members",
                params: { workspaceId: workspace.id },
              });
            },
          },
          ...(canCreateTask
            ? [
                {
                  value: "create-task",
                  label: t("navigation:commandPalette.createTask"),
                  shortcutId: "createTask" as const,
                  onRun: () => setIsCreateTaskOpen(true),
                },
              ]
            : []),
          ...(canCreateProject
            ? [
                {
                  value: "create-project",
                  label: t("navigation:commandPalette.createProject"),
                  shortcutId: "createProject" as const,
                  onRun: () => setIsCreateProjectOpen(true),
                },
              ]
            : []),
        ],
      },
      {
        value: "commands",
        label: t("navigation:commandPalette.commands"),
        items: [
          ...(canCreateWorkspace
            ? [
                {
                  value: "create-workspace",
                  label: t("navigation:commandPalette.createWorkspace"),
                  onRun: () => setIsCreateWorkspaceOpen(true),
                },
              ]
            : []),
          {
            value: "theme-light",
            label: t("navigation:commandPalette.lightTheme"),
            onRun: () => setTheme("light"),
          },
          {
            value: "theme-dark",
            label: t("navigation:commandPalette.darkTheme"),
            onRun: () => setTheme("dark"),
          },
          {
            value: "theme-system",
            label: t("navigation:commandPalette.systemTheme"),
            onRun: () => setTheme("system"),
          },
          {
            value: "keyboard-shortcuts",
            label: t("navigation:commandPalette.keyboardShortcuts"),
            shortcutId: "openShortcuts",
            onRun: () => openShortcutsPanel(true),
          },
        ],
      },
    ],
    [
      navigate,
      setTheme,
      t,
      workspace?.id,
      canCreateWorkspace,
      canCreateTask,
      canCreateProject,
      openShortcutsPanel,
    ],
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup instant finalFocus={false}>
          <Command>
            <CommandInput
              placeholder={t("navigation:commandPalette.inputPlaceholder")}
            />
            <CommandPanel>
              <CommandEmpty>
                {t("navigation:commandPalette.empty")}
              </CommandEmpty>
              <CommandList>
                {groupedItems.map((group, groupIndex) => (
                  <Fragment key={group.value}>
                    <CommandGroup>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      {group.items.map((item) => {
                        return (
                          <CommandItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                            onSelect={() => runCommand(item.onRun)}
                            className="px-3"
                          >
                            <span className="flex-1">{item.label}</span>
                            {item.shortcutId && (
                              <CommandShortcut>
                                <ShortcutKeys
                                  id={item.shortcutId}
                                  tone="muted"
                                />
                              </CommandShortcut>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    {groupIndex < groupedItems.length - 1 && (
                      <CommandSeparator />
                    )}
                  </Fragment>
                ))}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>
                      <ArrowUpIcon />
                    </Kbd>
                    <Kbd>
                      <ArrowDownIcon />
                    </Kbd>
                  </KbdGroup>
                  <span>{t("navigation:commandPalette.footer.navigate")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>
                    <CornerDownLeftIcon />
                  </Kbd>
                  <span>{t("navigation:commandPalette.footer.open")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>Esc</Kbd>
                <span>{t("navigation:commandPalette.footer.close")}</span>
              </div>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <SearchCommandMenu open={isSearchOpen} setOpen={setIsSearchOpen} />
      {workspace?.id && canCreateTask ? (
        <NewTaskDialog
          workspaceId={workspace.id}
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          onCreated={() => undefined}
        />
      ) : null}
      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
      {canCreateProject && (
        <CreateProjectModal
          open={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
        />
      )}
    </>
  );
}

export default CommandPalette;
