import { z } from 'zod';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
};

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').refine((s) => !isNaN(Date.parse(s)), 'invalid date');
export const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM');

export function errorHandler(err, req, res, _next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists' });
  if (err.code === '23503') return res.status(409).json({ error: 'Referenced record missing or still in use' });
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
}
