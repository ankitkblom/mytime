import nodemailer from 'nodemailer';
import { config } from './config.js';

const transport = config.smtp ? nodemailer.createTransport(config.smtp) : null;
export const outbox = []; // dev/test visibility when SMTP isn't configured

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendMail({ to, subject, text, html }) {
  const msg = { from: config.mailFrom, to, subject, text, html: html ?? `<p>${esc(text).replace(/\n/g, '<br>')}</p>` };
  if (!transport) {
    outbox.push(msg);
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail(msg);
}
