import { env } from "../config/env";
import { ConsoleEmailService } from "./email/console.email";
import type { EmailService } from "./email/email.service";
import { ResendEmailService } from "./email/resend.email";

/**
 * External integrations live behind interfaces and are resolved here, so tests
 * and other environments can swap implementations with `setServices`.
 */
export interface Services {
  email: EmailService;
}

function defaultServices(): Services {
  return {
    email:
      env.EMAIL_PROVIDER === "resend"
        ? new ResendEmailService(env.RESEND_API_KEY!, env.EMAIL_FROM)
        : new ConsoleEmailService(),
  };
}

let current: Services = defaultServices();

export function services(): Services {
  return current;
}

export function setServices(overrides: Partial<Services>): void {
  current = { ...current, ...overrides };
}
