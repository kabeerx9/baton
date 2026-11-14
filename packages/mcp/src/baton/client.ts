export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export class BatonClient {
  readonly baseUrl: string;
  readonly usingApiKey = true;
  private readonly apiKey: string;

  constructor(options: { baseUrl: string; apiKey: string }) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  private async authorizedFetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const timeoutSignal = AbortSignal.timeout(10_000);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    return fetch(url, { ...init, headers, signal });
  }

  async json<T = Json>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.authorizedFetch(path, init);
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      let detail: string;
      if (
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
      ) {
        detail = (body as { message: string }).message;
      } else if (typeof body === "string" && body.length > 0) {
        detail = body.length > 500 ? `${body.slice(0, 500)}…` : body;
      } else {
        detail = `HTTP ${res.status}`;
      }
      const code =
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        typeof (body as { code: unknown }).code === "string"
          ? ` (${(body as { code: string }).code})`
          : "";
      throw new Error(`${path}: ${detail}${code}`);
    }
    return body as T;
  }
}
