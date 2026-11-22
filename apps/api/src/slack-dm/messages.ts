export type TaskRef = { key: string; title: string; url: string };

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function link(task: TaskRef) {
  return `<${task.url}|${escape(`${task.key} ${task.title}`)}>`;
}

/** Someone marked their task as blocked by yours. */
export function waitingOnYouMessage({
  waiterName,
  blocker,
  blocked,
}: {
  waiterName: string | null;
  blocker: TaskRef;
  blocked: TaskRef;
}) {
  const who = waiterName ? escape(waiterName) : "A task";
  return `*${who} is waiting on you*\n${link(blocker)} blocks ${link(blocked)}.`;
}

/** A task that blocked yours is finished. */
export function unblockedMessage({
  blocker,
  blocked,
  stillWaitingOn,
}: {
  blocker: TaskRef;
  blocked: TaskRef;
  stillWaitingOn: TaskRef[];
}) {
  if (stillWaitingOn.length === 0) {
    return `*You can continue ${escape(blocked.key)}*\n${link(blocker)} is done. ${link(blocked)} is no longer blocked.`;
  }
  return `*${escape(blocker.key)} is done*\n${link(blocked)} still waits on ${stillWaitingOn.map(link).join(", ")}.`;
}

/** The morning list of your tasks that block someone's open work. */
export function digestMessage(
  items: { blocker: TaskRef; blocked: TaskRef; waiterName: string | null }[],
  myTasksUrl: string,
) {
  const blockers = new Set(items.map((item) => item.blocker.key)).size;
  const lines = items.map(
    (item) =>
      `• ${link(item.blocker)} blocks ${link(item.blocked)}${item.waiterName ? ` (${escape(item.waiterName)})` : ""}`,
  );
  return `*Waiting on you: ${blockers} ${blockers === 1 ? "task" : "tasks"}*\n${lines.join("\n")}\n<${myTasksUrl}|Open My tasks>`;
}

/**
 * Someone joined a workspace through a join link. Built from sentences so a
 * note from the sharer can be added later as one more part.
 */
export function welcomeMessage({
  workspaceName,
  sharerName,
  boardUrl,
}: {
  workspaceName: string;
  sharerName: string | null;
  boardUrl: string;
}) {
  const sentences = [`Welcome to *${escape(workspaceName)}* on Baton!`];
  if (sharerName?.trim()) {
    sentences.push(
      `${escape(sharerName.trim())} shared this workspace with you.`,
    );
  }
  sentences.push(`Open your board: <${boardUrl}>`);
  return sentences.join(" ");
}

/**
 * Someone created a workspace: the first thing they hear from Baton.
 * Sent once per workspace, to its owner. A person who arrives through a join
 * link is welcomed by `workspace.member_joined` instead, so nobody hears it
 * twice.
 */
export function workspaceWelcomeMessage({
  name,
  workspaceName,
  boardUrl,
}: {
  name: string | null;
  workspaceName: string;
  boardUrl: string;
}) {
  const hello = name?.trim()
    ? `Welcome to Baton, ${escape(name.trim())}!`
    : "Welcome to Baton!";
  return `*${hello}*\n*${escape(workspaceName)}* is ready. Open your board: <${boardUrl}>`;
}

export function testMessage() {
  return "*The tracker can reach you here.*\nYou will get a message when someone waits on your task, and when a task that blocks yours is done.";
}
