const DAY = 24 * 60 * 60 * 1000;

/** How long ago something was finished, in the words a person would use. */
export function dayLabel(finishedAt: string | Date, now = new Date()) {
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(new Date(finishedAt))) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  return `${Math.floor(days / 7)} weeks ago`;
}
