import { logger } from "../../config/logger";
import type { MpesaService, StkPushRequest, StkPushResponse, StkQueryResult } from "./mpesa.service";

export interface DarajaConfig {
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  /** Full callback URL including the secret token. */
  callbackUrl: string;
}

export class DarajaError extends Error {}

export class DarajaMpesaService implements MpesaService {
  readonly configured = true;
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly config: DarajaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get baseUrl() {
    return this.config.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const basic = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString("base64");
    const res = await this.fetchImpl(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new DarajaError(`Daraja auth failed (${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: string };
    this.token = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in) * 1000 };
    return this.token.value;
  }

  /** YYYYMMDDHHmmss in East Africa Time, as Daraja expects. */
  static timestamp(date = new Date()): string {
    const eat = new Date(date.getTime() + 3 * 3600_000);
    return eat.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  }

  private password(timestamp: string) {
    return Buffer.from(`${this.config.shortcode}${this.config.passkey}${timestamp}`).toString("base64");
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as T & { errorMessage?: string; errorCode?: string };
    if (!res.ok) {
      logger.warn({ status: res.status, errorCode: body.errorCode }, "Daraja request rejected");
      throw new DarajaError(body.errorMessage ?? `Daraja request failed (${res.status})`);
    }
    return body;
  }

  async stkPush(req: StkPushRequest): Promise<StkPushResponse> {
    const timestamp = DarajaMpesaService.timestamp();
    const body = await this.post<{ MerchantRequestID: string; CheckoutRequestID: string; ResponseCode: string; ResponseDescription: string; CustomerMessage: string }>(
      "/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: this.config.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(req.amountKes),
        PartyA: req.msisdn,
        PartyB: this.config.shortcode,
        PhoneNumber: req.msisdn,
        CallBackURL: this.config.callbackUrl,
        AccountReference: req.accountReference.slice(0, 12),
        TransactionDesc: req.description.slice(0, 13),
      },
    );
    if (body.ResponseCode !== "0") throw new DarajaError(body.ResponseDescription);
    return { merchantRequestId: body.MerchantRequestID, checkoutRequestId: body.CheckoutRequestID, customerMessage: body.CustomerMessage };
  }

  async queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
    const timestamp = DarajaMpesaService.timestamp();
    try {
      const body = await this.post<{ ResultCode?: string; ResultDesc?: string }>("/mpesa/stkpushquery/v1/query", {
        BusinessShortCode: this.config.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      });
      return { resultCode: body.ResultCode !== undefined ? String(body.ResultCode) : undefined, resultDesc: body.ResultDesc ?? "" };
    } catch (err) {
      // Daraja answers "The transaction is being processed" with an error status while the customer is still on the prompt.
      if (err instanceof DarajaError && /being processed/i.test(err.message)) return { resultDesc: err.message };
      throw err;
    }
  }
}
