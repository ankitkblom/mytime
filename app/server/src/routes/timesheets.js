import { Router } from 'express';
import { z } from 'zod';
import { q, tx, audit } from '../db.js';
import { config } from '../config.js';
import { sendMail } from '../mail.js';
import { SLOT_COUNT } from '../slots.js';
import { wrap, parse, HttpError, dateStr } from '../http.js';

const r = Router();
const today = () => new Date().toISOString().slice(0, 10);

export async function loadSheet(userId, date, client) {
  const { rows } = await (client || { query: q }).query(
    `SELECT s.*, rv.name AS reviewer_name, rv.email AS reviewer_email
       FROM day_sheets s LEFT JOIN users rv ON rv.id = s.reviewer_id
      WHERE s.user_id = $1 AND s.work_date = $2`, [userId, date]);
  return rows[0] || null;
}

export async function loadEntries(sheetId) {
  const { rows } = await q(
    `SELECT e.slot_index AS "slot", e.project_id AS "projectId", p.code AS "projectCode", p.name AS "projectName",
            e.category_id AS "categoryId", c.name AS "category",
            e.description
       FROM slot_entries e JOIN projects p ON p.id = e.project_id
       LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.day_sheet_id = $1 ORDER BY e.slot_index`, [sheetId]);
  return rows;
}

const shape = (s, entries) => s && ({
  id: s.id, date: s.work_date, status: s.status, reviewerId: s.reviewer_id, reviewerName: s.reviewer_name,
  submittedAt: s.submitted_at, reviewedAt: s.reviewed_at, reviewComment: s.review_comment, entries,
});

r.get('/timesheets/:date', wrap(async (req, res) => {
  const date = parse(dateStr, req.params.date);
  const s = await loadSheet(req.user.id, date);
  res.json(s ? shape(s, await loadEntries(s.id)) : { id: null, date, status: 'draft', entries: [] });
}));

const entrySchema = z.object({
  slot: z.number().int().min(0).max(SLOT_COUNT - 1),
  projectId: z.number().int(),
  categoryId: z.number().int().nullish(),
  description: z.string().trim().max(500).nullish(),
});

// Replace the whole day's entries (autosave friendly). Only while draft/rejected.
r.put('/timesheets/:date', wrap(async (req, res) => {
  const date = parse(dateStr, req.params.date);
  const { entries } = parse(z.object({ entries: z.array(entrySchema).max(SLOT_COUNT) }), req.body);
  if (date > today()) throw new HttpError(400, 'Cannot fill a future date');
  if (new Set(entries.map((e) => e.slot)).size !== entries.length) throw new HttpError(400, 'Duplicate slot');

  const ids = [...new Set(entries.map((e) => e.projectId))];
  if (ids.length) {
    const { rows } = await q('SELECT id, category_id FROM projects WHERE active AND id = ANY($1)', [ids]);
    if (rows.length !== ids.length) throw new HttpError(400, 'Unknown or inactive project');
    const proj = new Map(rows.map((x) => [x.id, x]));
    for (const e of entries) {
      const p = proj.get(e.projectId);
      if (!e.categoryId || e.categoryId !== p.category_id)
        throw new HttpError(400, 'Project does not belong to the selected category');
    }
  }
  const catIds = [...new Set(entries.map((e) => e.categoryId).filter(Boolean))];
  const cats = new Map();
  if (catIds.length) (await q('SELECT id FROM categories WHERE active AND parent_id IS NULL AND id = ANY($1)', [catIds])).rows.forEach((c) => cats.set(c.id, c));
  for (const e of entries) {
    if (e.categoryId && !cats.has(e.categoryId)) throw new HttpError(400, 'Unknown category');
  }

  const out = await tx(async (c) => {
    await c.query('INSERT INTO day_sheets(user_id, work_date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, date]);
    const { rows } = await c.query('SELECT * FROM day_sheets WHERE user_id = $1 AND work_date = $2 FOR UPDATE', [req.user.id, date]);
    const s = rows[0];
    if (!['draft', 'rejected'].includes(s.status)) throw new HttpError(409, `Sheet is ${s.status} and locked`);
    await c.query('DELETE FROM slot_entries WHERE day_sheet_id = $1', [s.id]);
    for (const e of entries) {
      await c.query(
        'INSERT INTO slot_entries(day_sheet_id, slot_index, project_id, category_id, description) VALUES ($1,$2,$3,$4,$5)',
        [s.id, e.slot, e.projectId, e.categoryId ?? null, e.description || null]);
    }
    return s;
  });
  res.json(shape(await loadSheet(req.user.id, date), await loadEntries(out.id)));
}));

// Submit for review: pick a reviewer, they get an email
r.post('/timesheets/:date/submit', wrap(async (req, res) => {
  const date = parse(dateStr, req.params.date);
  const { reviewerId } = parse(z.object({ reviewerId: z.number().int() }), req.body);
  if (reviewerId === req.user.id) throw new HttpError(400, 'You cannot review your own timesheet');
  const rv = (await q('SELECT id, name, email FROM users WHERE id = $1 AND active', [reviewerId])).rows[0];
  if (!rv) throw new HttpError(400, 'Reviewer not found');

  const hours = await tx(async (c) => {
    const s = await loadSheet(req.user.id, date, c);
    if (!s) throw new HttpError(400, 'Nothing to submit');
    if (!['draft', 'rejected'].includes(s.status)) throw new HttpError(409, `Sheet is already ${s.status}`);
    const n = (await c.query('SELECT count(*)::int AS n FROM slot_entries WHERE day_sheet_id = $1', [s.id])).rows[0].n;
    if (!n) throw new HttpError(400, 'Fill at least one slot before submitting');
    await c.query(
      `UPDATE day_sheets SET status='submitted', reviewer_id=$2, submitted_at=now(), reviewed_at=NULL, review_comment=NULL WHERE id=$1`, [s.id, rv.id]);
    await audit(req.user.id, 'submit', { date, reviewerId: rv.id }, c);
    return n / 2;
  });

  // Email failure must not undo the submission; the reviewer still sees it in their queue.
  sendMail({
    to: rv.email,
    subject: `Timesheet review requested: ${req.user.name} (${date})`,
    text: `Hi ${rv.name},\n\n${req.user.name} (${req.user.emp_id}) submitted their timesheet for ${date} (${hours} hours) for your review.\n\nReview it here: ${config.appUrl}/reviews\n`,
  }).catch((e) => console.error('mail failed', e.message));

  res.json(shape(await loadSheet(req.user.id, date), await loadEntries((await loadSheet(req.user.id, date)).id)));
}));

// ---- reviewer side ----
r.get('/reviews', wrap(async (req, res) => {
  const status = parse(z.enum(['submitted', 'approved', 'rejected']).default('submitted'), req.query.status);
  const { rows } = await q(
    `SELECT s.id, s.work_date AS date, s.status, s.submitted_at AS "submittedAt", s.reviewed_at AS "reviewedAt",
            u.name AS "employeeName", u.emp_id AS "empId",
            ((SELECT count(*) FROM slot_entries e WHERE e.day_sheet_id = s.id) * 0.5)::float AS hours
       FROM day_sheets s JOIN users u ON u.id = s.user_id
      WHERE s.reviewer_id = $1 AND s.status = $2 ORDER BY s.work_date DESC, s.id DESC LIMIT 200`, [req.user.id, status]);
  res.json(rows);
}));

async function ownedSheet(req) {
  const id = parse(z.coerce.number().int(), req.params.id);
  const { rows } = await q(
    `SELECT s.*, u.name AS employee_name, u.email AS employee_email, u.emp_id
       FROM day_sheets s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [id]);
  const s = rows[0];
  if (!s || s.reviewer_id !== req.user.id) throw new HttpError(404, 'Not found'); // 404 hides existence
  return s;
}

r.get('/reviews/:id', wrap(async (req, res) => {
  const s = await ownedSheet(req);
  res.json({ ...shape(s, await loadEntries(s.id)), employeeName: s.employee_name, empId: s.emp_id });
}));

r.post('/reviews/:id/decision', wrap(async (req, res) => {
  const b = parse(z.object({ decision: z.enum(['approved', 'rejected']), comment: z.string().trim().max(500).optional() }), req.body);
  if (b.decision === 'rejected' && !b.comment) throw new HttpError(400, 'A comment is required when rejecting');
  const s = await ownedSheet(req);
  const upd = await q(
    `UPDATE day_sheets SET status=$2, reviewed_at=now(), review_comment=$3 WHERE id=$1 AND status='submitted' RETURNING id`,
    [s.id, b.decision, b.comment || null]);
  if (!upd.rows[0]) throw new HttpError(409, 'Already reviewed');
  await audit(req.user.id, `review_${b.decision}`, { sheetId: s.id });
  sendMail({
    to: s.employee_email,
    subject: `Your timesheet for ${s.work_date} was ${b.decision}`,
    text: `Hi ${s.employee_name},\n\n${req.user.name} ${b.decision} your timesheet for ${s.work_date}.${b.comment ? `\nComment: ${b.comment}` : ''}\n${b.decision === 'rejected' ? `\nPlease edit and resubmit: ${config.appUrl}/timesheet?date=${s.work_date}\n` : ''}`,
  }).catch((e) => console.error('mail failed', e.message));
  res.json({ ok: true });
}));

export default r;
