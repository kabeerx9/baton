export type DigestTime = { hour: number; minute: number };

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `SLACK_DIGEST_TIME`: a 24-hour `HH:MM` local send time, else null. */
export function parseDigestTime(raw: string | undefined): DigestTime | null {
  const match = raw === undefined ? null : HH_MM.exec(raw);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
