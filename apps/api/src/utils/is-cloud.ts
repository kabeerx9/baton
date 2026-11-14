export function isCloud(): boolean {
  return process.env.BATON_CLOUD === "true";
}
