import { AppError } from "../../utils/app-error";
import type { MpesaService, StkPushRequest, StkPushResponse, StkQueryResult } from "./mpesa.service";

export class DisabledMpesaService implements MpesaService {
  readonly configured = false;
  async stkPush(): Promise<StkPushResponse> {
    throw new AppError(503, "INTERNAL_ERROR", "M-Pesa payments are not configured on this server (set PAYMENTS_PROVIDER=mpesa).");
  }
  async queryStkStatus(): Promise<StkQueryResult> {
    return { resultDesc: "Payments not configured" };
  }
}

/** Test double. Tests decide what STK Query reports for each checkout request. */
export class FakeMpesaService implements MpesaService {
  readonly configured = true;
  readonly pushes: (StkPushRequest & StkPushResponse)[] = [];
  readonly queryResults = new Map<string, StkQueryResult>();
  failNextPush = false;
  private counter = 0;

  async stkPush(req: StkPushRequest): Promise<StkPushResponse> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error("Daraja unavailable");
    }
    this.counter += 1;
    const res = { merchantRequestId: `MR-${this.counter}`, checkoutRequestId: `ws_CO_TEST_${this.counter}_${Date.now()}`, customerMessage: "Success. Request accepted for processing" };
    this.pushes.push({ ...req, ...res });
    return res;
  }

  async queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
    return this.queryResults.get(checkoutRequestId) ?? { resultCode: "0", resultDesc: "The service request is processed successfully." };
  }
}
