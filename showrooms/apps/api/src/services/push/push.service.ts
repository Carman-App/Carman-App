import { logger } from "../../config/logger";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  /** Tokens Expo reports as no longer registered; callers remove them. */
  invalidTokens: string[];
}

export interface PushService {
  send(messages: PushMessage[]): Promise<PushResult>;
}

export class DisabledPushService implements PushService {
  async send(): Promise<PushResult> {
    return { invalidTokens: [] };
  }
}

export class MemoryPushService implements PushService {
  readonly sent: PushMessage[] = [];
  async send(messages: PushMessage[]): Promise<PushResult> {
    this.sent.push(...messages);
    return { invalidTokens: [] };
  }
}

/** Expo Push API. Sends in chunks of 100 (Expo's limit). */
export class ExpoPushService implements PushService {
  constructor(
    private readonly accessToken?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(messages: PushMessage[]): Promise<PushResult> {
    const invalidTokens: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await this.fetchImpl("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: "default", channelId: "default" }))),
          signal: AbortSignal.timeout(10_000),
        });
        const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
        body.data?.forEach((ticket, idx) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(chunk[idx]!.to);
        });
      } catch (err) {
        logger.warn({ err }, "Expo push send failed");
      }
    }
    return { invalidTokens };
  }
}
