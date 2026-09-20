import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { q } from './db.js';

export const COOKIE = 'bloom_session';
const SESSION_HOURS = 8;

export const isCompanyEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+$/.test(email) && email.toLowerCase().endsWith('@' + config.allowedDomain);

export function setSession(res, user) {
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: SESSION_HOURS * 3600 * 1000, path: '/',
  });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const { uid } = jwt.verify(token, config.jwtSecret);
    const { rows } = await q(
      `SELECT u.id, u.emp_id, u.name, u.email, u.role, u.designation, u.department_id, d.name AS department
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1 AND u.active`, [uid]);
    if (!rows[0] || !isCompanyEmail(rows[0].email)) return res.status(401).json({ error: 'Not signed in' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Not signed in' });
  }
}

export const requireAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
