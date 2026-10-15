const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function passwordResetEmail(name: string, link: string, minutes: number) {
  return {
    subject: "Reset your Showrooms password",
    text: `Hi ${name},\n\nUse this link to reset your password. It expires in ${minutes} minutes.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${escape(name)},</p><p>Use the button below to reset your password. It expires in ${minutes} minutes.</p><p><a href="${escape(link)}" style="background:#C2410C;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
  };
}
