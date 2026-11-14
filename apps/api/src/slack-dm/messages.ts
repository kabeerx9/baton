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

export function testMessage() {
  return "*The tracker can reach you here.*\nYou will get a message when someone waits on your task, and when a task that blocks yours is done.";
}
