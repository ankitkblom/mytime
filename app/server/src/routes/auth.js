import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { q, audit } from '../db.js';
import { config } from '../config.js';
import { sendMail } from '../mail.js';
import { COOKIE, isCompanyEmail, setSession, requireAuth } from '../auth.js';
import { wrap, parse, HttpError } from '../http.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const MAX_FAILS = 5, LOCK_MIN = 15, OTP_MIN = 10, OTP_TRIES = 5;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing for unknown users

const email = z.string().trim().toLowerCase().max(200);
const hashOtp = (code) => crypto.createHmac('sha256', config.jwtSecret).update(code).digest('hex');

async function issueOtp(user, purpose) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await q('UPDATE otp_challenges SET used = TRUE WHERE user_id = $1 AND NOT used', [user.id]);
  const { rows } = await q(
    `INSERT INTO otp_challenges(user_id, code_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' minutes')::interval) RETURNING id`,
    [user.id, hashOtp(code), String(OTP_MIN)]);
  await sendMail({
    to: user.email,
    subject: `Bloom Timesheet: your ${purpose} code`,
    text: `Hi ${user.name},\n\nYour verification code is ${code}. It expires in ${OTP_MIN} minutes.\nIf this wasn't you, ignore this email.`,
  }).catch((e) => {
    console.error('OTP mail failed:', e.message);
    throw new HttpError(503, 'Could not send the verification email. Please try again shortly or contact your admin.');
  });
  // Local dev only: DEV_SHOW_OTP=1 (ignored in production) surfaces the code so the UI can show it
  return { id: rows[0].id, devCode: config.devShowOtp ? code : undefined };
}

async function consumeOtp(challengeId, code) {
  const { rows } = await q('SELECT * FROM otp_challenges WHERE id = $1', [challengeId]);
  const c = rows[0];
  if (!c || c.used || c.expires_at < new Date() || c.attempts >= OTP_TRIES) throw new HttpError(401, 'Code expired or invalid');
  const ok = crypto.timingSafeEqual(Buffer.from(hashOtp(code)), Buffer.from(c.code_hash));
  if (!ok) {
    await q('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [c.id]);
    throw new HttpError(401, 'Code expired or invalid');
  }
  await q('UPDATE otp_challenges SET used = TRUE WHERE id = $1', [c.id]);
  return c.user_id;
}

// Step 1: email + password -> emails a 6-digit code (2nd factor)
r.post('/login', limiter, wrap(async (req, res) => {
  const b = parse(z.object({ email, password: z.string().min(1).max(200) }), req.body);
  const generic = new HttpError(401, 'Invalid email or password');
  if (!isCompanyEmail(b.email)) throw generic;
  const { rows } = await q('SELECT * FROM users WHERE email = $1 AND active', [b.email]);
  const u = rows[0];
  const locked = u?.locked_until && u.locked_until > new Date();
  const ok = await bcrypt.compare(b.password, u?.password_hash || DUMMY_HASH);
  if (!u || locked || !ok || !u.password_hash) {
    if (u && !locked) {
      const fails = u.failed_logins + 1;
      await q('UPDATE users SET failed_logins = $2, locked_until = CASE WHEN $2 >= $3 THEN now() + ($4 || \' minutes\')::interval END WHERE id = $1',
        [u.id, fails, MAX_FAILS, String(LOCK_MIN)]);
      await audit(u.id, 'login_failed');
    }
    throw generic;
  }
  await q('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [u.id]);
  const o = await issueOtp(u, 'sign-in');
  res.json({ challengeId: o.id, devCode: o.devCode });
}));

// Step 2: verify code -> session cookie
r.post('/verify', limiter, wrap(async (req, res) => {
  const b = parse(z.object({ challengeId: z.number().int(), code: z.string().regex(/^\d{6}$/) }), req.body);
  const uid = await consumeOtp(b.challengeId, b.code);
  const { rows } = await q('SELECT id FROM users WHERE id = $1 AND active', [uid]);
  if (!rows[0]) throw new HttpError(401, 'Code expired or invalid');
  setSession(res, rows[0]);
  await audit(uid, 'login');
  res.json({ ok: true });
}));

// First-time password setup and forgot-password share this flow (always responds the same)
r.post('/password/request', limiter, wrap(async (req, res) => {
  const b = parse(z.object({ email }), req.body);
  let challengeId = null, devCode;
  if (isCompanyEmail(b.email)) {
    const { rows } = await q('SELECT * FROM users WHERE email = $1 AND active', [b.email]);
    if (rows[0]) { const o = await issueOtp(rows[0], 'password setup'); challengeId = o.id; devCode = o.devCode; }
  }
  // unknown users get a plausible id so callers can't enumerate accounts
  res.json({ challengeId: challengeId ?? 0, devCode });
}));

r.post('/password/reset', limiter, wrap(async (req, res) => {
  const b = parse(z.object({
    challengeId: z.number().int(), code: z.string().regex(/^\d{6}$/),
    password: z.string().min(10, 'at least 10 characters').max(200),
  }), req.body);
  const uid = await consumeOtp(b.challengeId, b.code);
  await q('UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1', [uid, await bcrypt.hash(b.password, 12)]);
  await audit(uid, 'password_set');
  res.json({ ok: true });
}));

r.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
r.get('/me', requireAuth, (req, res) => res.json(req.user));

export default r;
