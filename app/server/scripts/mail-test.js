// Usage: npm run mail:test -- someone@bloom-india.com
import { sendMail } from '../src/mail.js';
import { config } from '../src/config.js';

const to = process.argv[2];
if (!to) { console.error('usage: npm run mail:test -- <recipient>'); process.exit(1); }
if (!config.smtp) console.warn('SMTP not configured: the message will only be printed');
await sendMail({ to, subject: 'Bloom Timesheet: SMTP test', text: 'If you can read this, outgoing email works.' });
console.log('sent (or printed) to', to);
process.exit(0);
