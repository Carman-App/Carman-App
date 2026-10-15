import { logger } from "../../config/logger";
import type { EmailMessage, EmailService } from "./email.service";

/** Development stand-in: prints the email so links can be followed locally. */
export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, `Email (not sent)\n${message.text}`);
  }
}

/** Test stand-in: keeps sent messages in memory. */
export class MemoryEmailService implements EmailService {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
