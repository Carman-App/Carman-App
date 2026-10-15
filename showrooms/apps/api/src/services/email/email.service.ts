export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Transactional email boundary. Implementations: Resend, console (dev), memory (tests). */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}
