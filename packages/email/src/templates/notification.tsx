import { Text } from "react-email";
import React from "react";
import { BoardColumn, type BoardColumnIcon } from "../components/board-column";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailShell } from "../components/email-shell";
import { type DateInput, formatShortDate } from "../components/format-date";
import { Spacer } from "../components/spacer";
import {
  TaskCard,
  type TaskCardPriority,
  type TaskCardProps,
} from "../components/task-card";
import { colors } from "../components/tokens";

void React;

export type NotificationEmailTask = Omit<
  TaskCardProps,
  "dueDate" | "priorityLabel"
> & {
  dueDate?: DateInput;
  column?: {
    name: string;
    icon?: BoardColumnIcon;
    count?: number;
  };
};

export type NotificationEmailProps = {
  title: string;
  message: string;
  actionUrl?: string | null;
  actionLabel?: string;
  breadcrumb?: string;
  task?: NotificationEmailTask;
  settingsUrl?: string;
};

const copy = {
  preview: "You have a new Baton notification",
  subtitle: "A notification matched your delivery preferences.",
  footer: "Baton notification",
  actionLabel: "Open in Baton",
  openTask: "Open task",
  manage: "Manage notifications",
  priority: {
    urgent: "Urgent priority",
    high: "High priority",
    medium: "Medium priority",
    low: "Low priority",
  },
} as const;

const NotificationEmail = ({
  title,
  message,
  actionUrl,
  actionLabel,
  breadcrumb,
  task,
  settingsUrl,
}: NotificationEmailProps) => {
  const lang = "en";
  const priority: TaskCardPriority | undefined = task?.priority;
  const card = task ? (
    <TaskCard
      {...task}
      dueDate={task.dueDate ? formatShortDate(task.dueDate, lang) : undefined}
      priorityLabel={priority ? copy.priority[priority] : undefined}
    />
  ) : null;

  return (
    <EmailShell
      title={title}
      preview={`${message} ${copy.preview}`}
      lang={lang}
    >
      <EmailIntro title={title} subtitle={message} />
      {breadcrumb ? (
        <Text className="k-muted" style={breadcrumbStyle}>
          {breadcrumb}
        </Text>
      ) : null}
      {task?.column ? (
        <BoardColumn
          name={task.column.name}
          icon={task.column.icon}
          count={task.column.count}
        >
          {card}
        </BoardColumn>
      ) : (
        card
      )}
      {actionUrl ? (
        <>
          {task ? <Spacer size={20} /> : null}
          <EmailButton href={actionUrl} icon="arrow-up-right-light">
            {actionLabel ?? (task ? copy.openTask : copy.actionLabel)}
          </EmailButton>
        </>
      ) : null}
      <Spacer size={40} />
      <EmailFooter
        title={copy.footer}
        reason={copy.subtitle}
        links={settingsUrl ? [{ label: copy.manage, href: settingsUrl }] : []}
      />
    </EmailShell>
  );
};

const breadcrumbStyle = {
  margin: "-16px 0 20px",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};

NotificationEmail.PreviewProps = {
  title: "Sarah Chen assigned you a task",
  message: "You were assigned to Redesign transactional emails.",
  actionUrl: "https://baton.example.com/acme/task/KAN-128",
  breadcrumb: "Acme / Website",
  settingsUrl:
    "https://baton.example.com/dashboard/settings/account/notifications",
  task: {
    ticket: "KAN-128",
    title: "Redesign transactional emails",
    labels: [
      { name: "Design", color: "#8E51FF" },
      { name: "Email", color: "#00BC7D" },
    ],
    priority: "high",
    priorityLabel: "High priority",
    dueDate: "2026-10-14T00:00:00.000Z",
    dueStatus: "due-soon",
    assigneeInitials: "MK",
    column: { name: "In progress", icon: "circle-dot", count: 3 },
  },
} as NotificationEmailProps;

export default NotificationEmail;
