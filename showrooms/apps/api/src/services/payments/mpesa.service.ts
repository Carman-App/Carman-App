export interface StkPushRequest {
  /** 2547XXXXXXXX */
  msisdn: string;
  amountKes: number;
  accountReference: string;
  description: string;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

export interface StkQueryResult {
  /** "0" = paid. Anything else is a failure or cancellation; undefined means still processing. */
  resultCode?: string;
  resultDesc: string;
}

/** Safaricom Daraja boundary. Credentials never leave the server. */
export interface MpesaService {
  readonly configured: boolean;
  stkPush(req: StkPushRequest): Promise<StkPushResponse>;
  queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult>;
}
