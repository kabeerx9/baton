export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** LOG_LEVEL, or info in production and debug elsewhere. Unknown values use the default. */
export function parseLogLevel(
  value: string | undefined,
  nodeEnv: string | undefined,
): LogLevel {
  const wanted = value?.trim().toLowerCase();
  if (wanted && (LOG_LEVELS as readonly string[]).includes(wanted))
    return wanted as LogLevel;
  return nodeEnv === "production" ? "info" : "debug";
}

export function isEnabled(level: LogLevel, threshold: LogLevel): boolean {
  return RANK[level] >= RANK[threshold];
}
