export function emailAsset(name: string): string {
  const explicit = process.env.BATON_EMAIL_ASSETS_URL;
  const clientUrl = process.env.BATON_CLIENT_URL;
  const base = explicit
    ? explicit
    : clientUrl
      ? `${clientUrl.replace(/\/$/, "")}/email`
      : "/static";

  return `${base.replace(/\/$/, "")}/${name}.png`;
}
