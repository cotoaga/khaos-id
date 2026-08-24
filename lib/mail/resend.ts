// All khaos-id auth mail goes through Resend (COT-151) — the Supabase
// built-in mailer is retired for invite/request/approve/activation mail
// (it stays wired for nothing else, since those flows never send email).

import { Resend } from "resend";

let cachedClient: Resend | undefined;

function client(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set — cannot send mail");
  }
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

export interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailArgs): Promise<void> {
  const from = process.env.KHAOS_ID_MASTER;
  if (!from) {
    throw new Error("KHAOS_ID_MASTER is not set — cannot send mail");
  }

  const { error } = await client().emails.send({
    from: `khaos-id <${from}>`,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
