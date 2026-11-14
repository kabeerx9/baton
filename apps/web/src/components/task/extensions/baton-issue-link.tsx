import {
  isValidUrl,
  BatonIssueLink as BatonIssueLinkNode,
} from "@baton/editor";
import { useQuery } from "@tanstack/react-query";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import getProject from "@/fetchers/project/get-project";
import getTask from "@/fetchers/task/get-task";

function parseTaskRouteFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/dashboard\/workspace\/([^/]+)\/project\/([^/]+)\/task\/([^/]+)(?:\/|$)/i,
    );
    if (!match) return null;
    return {
      workspaceId: match[1],
      projectId: match[2],
      taskId: match[3],
    };
  } catch {
    return null;
  }
}

function BatonIssueLinkView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const issueKey = String(node.attrs.issueKey || "");
  const taskIdAttr = String(node.attrs.taskId || "");
  const url = String(node.attrs.url || "");
  const taskRoute = parseTaskRouteFromUrl(url);
  const taskId = taskIdAttr || taskRoute?.taskId || "";

  const { data: task } = useQuery({
    queryKey: ["task", taskId, "baton-issue-link"],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId),
    staleTime: 1000 * 60,
  });
  const { data: project } = useQuery({
    queryKey: [
      "projects",
      taskRoute?.workspaceId,
      taskRoute?.projectId,
      "baton-issue-link",
    ],
    queryFn: () =>
      getProject({
        id: taskRoute?.projectId ?? "",
        workspaceId: taskRoute?.workspaceId ?? "",
      }),
    enabled: Boolean(taskRoute?.workspaceId && taskRoute?.projectId),
    staleTime: 1000 * 60,
  });

  const projectSlug = project?.slug ? String(project.slug).toUpperCase() : "";
  const resolvedIssueKey =
    issueKey ||
    (projectSlug && task?.number ? `${projectSlug}-${task.number}` : "");
  const title = task?.title || issueKey || t("tasks:entity.task");
  const status = task?.status
    ? t(`tasks:status.${task.status}`)
    : t("tasks:status.to-do");
  const priority = task?.priority
    ? t(`tasks:priority.${task.priority}`)
    : t("tasks:priority.no-priority");
  const assignee = task?.assigneeName || t("tasks:assignee.unassigned");
  const resolvedHref =
    taskRoute?.workspaceId && taskRoute?.projectId && task?.id
      ? `/dashboard/workspace/${taskRoute.workspaceId}/project/${taskRoute.projectId}/task/${task.id}`
      : url;
  const isInternal = resolvedHref.startsWith("/");
  const href = isInternal || isValidUrl(resolvedHref) ? resolvedHref : "";

  return (
    <NodeViewWrapper as="span" className="baton-issue-link-node">
      <HoverCard openDelay={160} closeDelay={120}>
        <HoverCardTrigger asChild>
          <a
            href={href || undefined}
            target={isInternal ? undefined : "_blank"}
            rel={isInternal ? undefined : "noopener noreferrer"}
            className="baton-issue-link-chip"
          >
            {resolvedIssueKey ? (
              <span className="baton-issue-link-key">{resolvedIssueKey}</span>
            ) : null}
            <span className="baton-issue-link-title">{title}</span>
          </a>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          sideOffset={8}
          className="baton-issue-link-preview"
        >
          <div className="baton-issue-link-preview-top">
            <span className="baton-issue-link-preview-key">
              {resolvedIssueKey || t("tasks:entity.task")}
            </span>
            <span className="baton-issue-link-preview-assignee">
              {assignee}
            </span>
          </div>
          <p className="baton-issue-link-preview-title">{title}</p>
          <div className="baton-issue-link-preview-meta">
            <span>{status}</span>
            <span>·</span>
            <span>{priority}</span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
}

export const BatonIssueLink = BatonIssueLinkNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(BatonIssueLinkView);
  },
});
