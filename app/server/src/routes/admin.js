import { Router } from 'express';
import { z } from 'zod';
import { q, audit } from '../db.js';
import { isCompanyEmail } from '../auth.js';
import { config } from '../config.js';
import { wrap, parse, HttpError } from '../http.js';

const r = Router();

const userBody = z.object({
  empId: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(200),
  departmentId: z.number().int().nullish(),
  designation: z.string().trim().max(100).nullish(),
  role: z.enum(['employee', 'admin']).default('employee'),
  active: z.boolean().default(true),
});

const checkEmail = (email) => {
  if (!isCompanyEmail(email)) throw new HttpError(400, `Email must be @${config.allowedDomain}`);
};

r.get('/admin/users', wrap(async (req, res) => {
  const { rows } = await q(
    `SELECT u.id, u.emp_id AS "empId", u.name, u.email, u.designation, u.role, u.active, u.department_id AS "departmentId",
            d.name AS department, (u.password_hash IS NOT NULL) AS "hasPassword"
       FROM users u LEFT JOIN departments d ON d.id = u.department_id ORDER BY u.name`);
  res.json(rows);
}));

r.post('/admin/users', wrap(async (req, res) => {
  const b = parse(userBody, req.body);
  checkEmail(b.email);
  const { rows } = await q(
    `INSERT INTO users(emp_id, name, email, department_id, designation, role, active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [b.empId, b.name, b.email, b.departmentId ?? null, b.designation ?? null, b.role, b.active]);
  await audit(req.user.id, 'user_create', { id: rows[0].id, email: b.email });
  res.status(201).json({ id: rows[0].id }); // user sets their own password via "Set password" (email OTP)
}));

r.put('/admin/users/:id', wrap(async (req, res) => {
  const id = parse(z.coerce.number().int(), req.params.id);
  const b = parse(userBody, req.body);
  checkEmail(b.email);
  if (id === req.user.id && (!b.active || b.role !== 'admin')) throw new HttpError(400, 'You cannot deactivate or demote yourself');
  const { rowCount } = await q(
    `UPDATE users SET emp_id=$2, name=$3, email=$4, department_id=$5, designation=$6, role=$7, active=$8 WHERE id=$1`,
    [id, b.empId, b.name, b.email, b.departmentId ?? null, b.designation ?? null, b.role, b.active]);
  if (!rowCount) throw new HttpError(404, 'Not found');
  await audit(req.user.id, 'user_update', { id });
  res.json({ ok: true });
}));

const deptBody = z.object({ name: z.string().trim().min(1).max(100), code: z.string().trim().max(20).nullish(), parentId: z.number().int().nullish() });
r.post('/admin/departments', wrap(async (req, res) => {
  const b = parse(deptBody, req.body);
  const { rows } = await q('INSERT INTO departments(name, code, parent_id) VALUES ($1,$2,$3) RETURNING id', [b.name, b.code || null, b.parentId ?? null]);
  res.status(201).json({ id: rows[0].id });
}));

const catBody = z.object({ name: z.string().trim().min(1).max(100), active: z.boolean().default(true) });
r.post('/admin/categories', wrap(async (req, res) => {
  const b = parse(catBody, req.body);
  const { rows } = await q('INSERT INTO categories(name, active) VALUES ($1,$2) RETURNING id', [b.name, b.active]);
  res.status(201).json({ id: rows[0].id });
}));
r.put('/admin/categories/:id', wrap(async (req, res) => {
  const id = parse(z.coerce.number().int(), req.params.id);
  const b = parse(z.object({ name: z.string().trim().min(1).max(100), active: z.boolean() }), req.body);
  await q('UPDATE categories SET name=$2, active=$3 WHERE id=$1', [id, b.name, b.active]);
  res.json({ ok: true });
}));

const projBody = z.object({ code: z.string().trim().min(1).max(30), name: z.string().trim().min(1).max(150),
  categoryId: z.number().int().nullish(), active: z.boolean().default(true) });

async function checkProjectCategory(categoryId) {
  if (!categoryId) return;
  const c = (await q('SELECT 1 FROM categories WHERE id = $1 AND parent_id IS NULL', [categoryId])).rows[0];
  if (!c) throw new HttpError(400, 'Category not found');
}

r.get('/admin/projects', wrap(async (req, res) => {
  res.json((await q(
    `SELECT p.id, p.code, p.name, p.active, p.category_id AS "categoryId", c.name AS category
       FROM projects p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.code`)).rows);
}));
r.post('/admin/projects', wrap(async (req, res) => {
  const b = parse(projBody, req.body);
  await checkProjectCategory(b.categoryId);
  const { rows } = await q('INSERT INTO projects(code, name, category_id, active) VALUES ($1,$2,$3,$4) RETURNING id',
    [b.code, b.name, b.categoryId ?? null, b.active]);
  await audit(req.user.id, 'project_create', { code: b.code });
  res.status(201).json({ id: rows[0].id });
}));
r.put('/admin/projects/:id', wrap(async (req, res) => {
  const id = parse(z.coerce.number().int(), req.params.id);
  const b = parse(projBody, req.body);
  await checkProjectCategory(b.categoryId);
  const { rowCount } = await q('UPDATE projects SET code=$2, name=$3, category_id=$4, active=$5 WHERE id=$1',
    [id, b.code, b.name, b.categoryId ?? null, b.active]);
  if (!rowCount) throw new HttpError(404, 'Not found');
  await audit(req.user.id, 'project_update', { id });
  res.json({ ok: true });
}));
// Bulk add: one "code - name" (or "code, name") per line, all under the same category/sub-category
r.post('/admin/projects/bulk', wrap(async (req, res) => {
  const b = parse(z.object({ lines: z.string().max(50000), categoryId: z.number().int().nullish() }), req.body);
  await checkProjectCategory(b.categoryId);
  let added = 0, skipped = [];
  for (const line of b.lines.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^(.+?)\s+[-–]\s+(.+)$/) || line.match(/^([^,]+?)\s*,\s*(.+)$/); // "928 - Name" or "928, Name"
    if (!m) { skipped.push(line); continue; }
    const { rowCount } = await q('INSERT INTO projects(code, name, category_id) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING',
      [m[1].trim(), m[2].trim(), b.categoryId ?? null]);
    rowCount ? added++ : skipped.push(line);
  }
  res.json({ added, skipped });
}));

r.get('/admin/categories', wrap(async (req, res) => {
  res.json((await q('SELECT id, name, active FROM categories WHERE parent_id IS NULL ORDER BY name')).rows);
}));

export default r;
