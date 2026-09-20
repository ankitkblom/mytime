import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const need = (k, dev) => {
  const v = process.env[k] ?? (isProd ? undefined : dev);
  if (v === undefined) throw new Error(`Missing env ${k}`);
  return v;
};

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  trustProxy: Number(process.env.TRUST_PROXY_HOPS || 1), // 1 = one proxy (Caddy/Render); 2 = Vercel -> Render
  databaseUrl: need('DATABASE_URL', 'postgres://postgres:postgres@localhost:5433/bloom'),
  jwtSecret: need('JWT_SECRET', 'dev-only-secret-change-me'),
  allowedDomain: (process.env.ALLOWED_EMAIL_DOMAIN || 'bloom-india.com').toLowerCase(),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  smtp: process.env.SMTP_HOST
    ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465, requireTLS: Number(process.env.SMTP_PORT || 587) !== 465,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
    : null,
  mailFrom: process.env.MAIL_FROM || 'Bloom Timesheet <no-reply@bloom-india.com>',
  adminEmail: process.env.ADMIN_EMAIL || 'ankit.kumar@bloom-india.com',
  adminPassword: process.env.ADMIN_PASSWORD, // used by seed
  devShowOtp: !isProd && process.env.DEV_SHOW_OTP === '1',
};

if (isProd && !config.smtp) throw new Error('SMTP_HOST/SMTP_USER/SMTP_PASS are required in production (login codes are sent by email)');
if (isProd && !config.databaseUrl) throw new Error('DATABASE_URL required');
if (isProd && config.jwtSecret.length < 32) throw new Error('JWT_SECRET must be >= 32 chars in production');
