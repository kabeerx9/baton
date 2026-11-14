import enUS from "../../../../i18n/en-US.json";

type Bundle = {
  common: { people: { someone: string } };
  notifications: {
    events: Record<string, Record<string, string>>;
    reminderLeadTime: Record<string, string>;
  };
  tasks: { status: Record<string, string> };
};

const bundle: Bundle = enUS;

type Vars = Record<string, unknown>;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function interpolate(template: string, vars: Vars) {
  return template.replace(PLACEHOLDER, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

function plural(forms: Record<string, string>, prefix: string, count: number) {
  const category = new Intl.PluralRules("en-US").select(count);
  const template =
    forms[`${prefix}_${category}`] ?? forms[`${prefix}_other`] ?? "";
  return interpolate(template, { count });
}

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function statusLabel(status: unknown) {
  const value = String(status ?? "");
  return Object.hasOwn(bundle.tasks.status, value)
    ? bundle.tasks.status[value]
    : toDisplayCase(value);
}

function leadTime(eventData: Vars) {
  const forms = bundle.notifications.reminderLeadTime;
  const minutes = Number(eventData.leadTimeMinutes ?? 1440);
  if (minutes % 1440 === 0) {
    return plural(forms, "days", minutes / 1440);
  }
  if (minutes % 60 === 0) {
    return plural(forms, "hours", minutes / 60);
  }
  return plural(forms, "minutes", minutes);
}

// Uses the same i18n keys as apps/web/src/components/notification/notification-text.ts
// so email, ntfy and webhook deliveries read like the in-app list.
export function getDeliveryContent(
  type: string,
  eventData: Vars,
): { title: string; body: string } | null {
  // Ignore inherited keys such as "constructor" when looking up copy.
  const copy = Object.hasOwn(bundle.notifications.events, type)
    ? bundle.notifications.events[type]
    : undefined;
  if (!copy) return null;

  let vars: Vars = eventData;
  const content = copy.content;
  if (type === "task_mention") {
    const name = eventData.mentionerName;
    vars = {
      ...eventData,
      mentionerName:
        typeof name === "string" && name.trim()
          ? name
          : bundle.common.people.someone,
    };
  } else if (type === "task_status_changed") {
    vars = {
      ...eventData,
      oldStatus: statusLabel(eventData.oldStatus),
      newStatus: statusLabel(eventData.newStatus),
    };
  } else if (type === "due_date_reminder") {
    vars = { ...eventData, leadTime: leadTime(eventData) };
  }

  const title = copy.title ?? "";
  const body = content ?? "";
  // Keep the existing fallback for payloads still missing required values.
  const missing = [...`${title}${body}`.matchAll(PLACEHOLDER)].some(
    ([, key]) => vars[key as string] == null || vars[key as string] === "",
  );
  if (missing) return null;

  return { title: interpolate(title, vars), body: interpolate(body, vars) };
}
