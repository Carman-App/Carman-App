import { env } from "../config/env";
import { ConsoleEmailService } from "./email/console.email";
import type { EmailService } from "./email/email.service";
import { ResendEmailService } from "./email/resend.email";
import { CloudinaryMediaService } from "./media/cloudinary.media";
import { DisabledMediaService } from "./media/fake.media";
import { LocalMediaService } from "./media/local.media";
import type { MediaService } from "./media/media.service";
import { DarajaMpesaService } from "./payments/daraja.mpesa";
import { DisabledMpesaService } from "./payments/fake.mpesa";
import type { MpesaService } from "./payments/mpesa.service";
import { DisabledPushService, ExpoPushService, type PushService } from "./push/push.service";

/**
 * External integrations live behind interfaces and are resolved here, so tests
 * and other environments can swap implementations with `setServices`.
 */
export interface Services {
  email: EmailService;
  media: MediaService;
  push: PushService;
  mpesa: MpesaService;
}

function callbackUrl(): string {
  const url = new URL(env.MPESA_CALLBACK_URL!);
  url.searchParams.set("token", env.MPESA_CALLBACK_TOKEN!);
  return url.toString();
}

function defaultServices(): Services {
  return {
    email:
      env.EMAIL_PROVIDER === "resend" ? new ResendEmailService(env.RESEND_API_KEY!, env.EMAIL_FROM) : new ConsoleEmailService(),
    media:
      env.MEDIA_PROVIDER === "cloudinary"
        ? new CloudinaryMediaService({ cloudName: env.CLOUDINARY_CLOUD_NAME!, apiKey: env.CLOUDINARY_API_KEY!, apiSecret: env.CLOUDINARY_API_SECRET! })
        : env.MEDIA_PROVIDER === "local"
          ? new LocalMediaService(env.MEDIA_LOCAL_DIR, env.PUBLIC_API_URL, env.POSTER_SIGNING_SECRET)
          : new DisabledMediaService(),
    push: env.PUSH_PROVIDER === "expo" ? new ExpoPushService(env.EXPO_ACCESS_TOKEN) : new DisabledPushService(),
    mpesa:
      env.PAYMENTS_PROVIDER === "mpesa"
        ? new DarajaMpesaService({
            environment: env.MPESA_ENV,
            consumerKey: env.MPESA_CONSUMER_KEY!,
            consumerSecret: env.MPESA_CONSUMER_SECRET!,
            shortcode: env.MPESA_SHORTCODE!,
            passkey: env.MPESA_PASSKEY!,
            callbackUrl: callbackUrl(),
          })
        : new DisabledMpesaService(),
  };
}

let current: Services = defaultServices();

export function services(): Services {
  return current;
}

export function setServices(overrides: Partial<Services>): void {
  current = { ...current, ...overrides };
}
