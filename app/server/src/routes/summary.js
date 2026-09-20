import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { wrap, parse, HttpError, monthStr, dateStr } from '../http.js';

const r = Router();

function target(req) {
  const id = req.query.userId ? parse(z.coerce.number().int(), req.query.userId) : req.user.id;
  if (id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Not allowed');
  return id;
}
const monthRange = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return [`${m}-01`, new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10)];
};

async function monthData(userId, month, approvedOnly) {
  const [from, to] = monthRange(month);
  const st = approvedOnly ? ['approved'] : ['submitted', 'approved'];
  const days = await q(
    `SELECT s.work_date AS date, to_char(s.work_date, 'Dy') AS day, s.status,
            (count(e.*) * 0.5)::float AS hours, rv.name AS "approvedBy", s.reviewed_at AS "approvedAt"
       FROM day_sheets s JOIN slot_entries e ON e.day_sheet_id = s.id LEFT JOIN users rv ON rv.id = s.reviewer_id
      WHERE s.user_id = $1 AND s.work_date >= $2 AND s.work_date < $3 AND s.status = ANY($4)
      GROUP BY s.id, rv.name ORDER BY s.work_date`, [userId, from, to, st]);
  const projects = await q(
    `SELECT p.code, p.name, (count(*) * 0.5)::float AS hours
       FROM day_sheets s JOIN slot_entries e ON e.day_sheet_id = s.id JOIN projects p ON p.id = e.project_id
      WHERE s.user_id = $1 AND s.work_date >= $2 AND s.work_date < $3 AND s.status = ANY($4)
      GROUP BY p.id ORDER BY hours DESC, p.code`, [userId, from, to, st]);
  const total = days.rows.reduce((a, d) => a + d.hours, 0);
  return { month, approvedOnly, totalHours: total, days: days.rows, projects: projects.rows };
}

r.get('/summary/month', wrap(async (req, res) => {
  const month = parse(monthStr, req.query.month);
  res.json(await monthData(target(req), month, req.query.approvedOnly !== 'false'));
}));

// Day-wise, slot-by-slot view (matches the "Employee Monthly Work Report" grid)
r.get('/summary/month.csv', wrap(async (req, res) => {
  const month = parse(monthStr, req.query.month);
  const userId = target(req);
  const [from, to] = monthRange(month);
  const { rows } = await q(
    `SELECT s.work_date AS date, to_char(s.work_date,'Dy') AS day, e.slot_index, p.code, p.name AS pname,
            c.name AS cat, e.description, s.status, rv.name AS approver
       FROM day_sheets s JOIN slot_entries e ON e.day_sheet_id = s.id JOIN projects p ON p.id = e.project_id
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN users rv ON rv.id = s.reviewer_id
      WHERE s.user_id = $1 AND s.work_date >= $2 AND s.work_date < $3 AND s.status = 'approved'
      ORDER BY s.work_date, e.slot_index`, [userId, from, to]);
  const { SLOTS } = await import('../slots.js');
  // CSV-injection guard: prefix cells that spreadsheets would treat as formulas
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const lines = [['Date', 'Day', 'Slot', 'Project', 'Category', 'Comments', 'Hours', 'Approved by'].map(cell).join(',')];
  for (const x of rows) lines.push([x.date, x.day, SLOTS[x.slot_index].label, `${x.code} - ${x.pname}`, x.cat, x.description, 0.5, x.approver].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="work-report-${month}.csv"`);
  res.send(lines.join('\n'));
}));

r.get('/summary/day', wrap(async (req, res) => {
  const date = parse(dateStr, req.query.date);
  const userId = target(req);
  const { rows } = await q(
    `SELECT s.id, s.status, rv.name AS "approvedBy", s.reviewed_at AS "approvedAt" FROM day_sheets s
       LEFT JOIN users rv ON rv.id = s.reviewer_id WHERE s.user_id = $1 AND s.work_date = $2`, [userId, date]);
  if (!rows[0]) return res.json({ date, status: 'none', totalHours: 0, projects: [] });
  const p = await q(
    `SELECT p.code, p.name, (count(*) * 0.5)::float AS hours FROM slot_entries e JOIN projects p ON p.id = e.project_id
      WHERE e.day_sheet_id = $1 GROUP BY p.id ORDER BY hours DESC`, [rows[0].id]);
  res.json({ date, status: rows[0].status, approvedBy: rows[0].approvedBy, approvedAt: rows[0].approvedAt,
    totalHours: p.rows.reduce((a, x) => a + x.hours, 0), projects: p.rows });
}));

// Admin: all employees for a month
r.get('/summary/team', wrap(async (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admin only');
  const month = parse(monthStr, req.query.month);
  const [from, to] = monthRange(month);
  const { rows } = await q(
    `SELECT u.id, u.emp_id AS "empId", u.name, d.name AS department,
            (count(e.slot_index) FILTER (WHERE s.status='approved') * 0.5)::float AS "approvedHours",
            (count(e.slot_index) FILTER (WHERE s.status='submitted') * 0.5)::float AS "pendingHours"
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN day_sheets s ON s.user_id = u.id AND s.work_date >= $1 AND s.work_date < $2
       LEFT JOIN slot_entries e ON e.day_sheet_id = s.id
      WHERE u.active GROUP BY u.id, d.name ORDER BY u.name`, [from, to]);
  res.json({ month, employees: rows });
}));

export default r;
