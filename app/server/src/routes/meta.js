import { Router } from 'express';
import { q } from '../db.js';
import { SLOTS } from '../slots.js';
import { wrap } from '../http.js';

const r = Router();

// Everything the timesheet form needs in one call
r.get('/meta', wrap(async (req, res) => {
  const [departments, categories, projects, reviewers] = await Promise.all([
    q('SELECT id, code, name, parent_id FROM departments ORDER BY name'),
    q('SELECT id, name FROM categories WHERE active AND parent_id IS NULL ORDER BY name'),
    q('SELECT id, code, name, category_id FROM projects WHERE active ORDER BY code'),
    q('SELECT id, name, email, designation FROM users WHERE active AND id <> $1 ORDER BY name', [req.user.id]),
  ]);
  res.json({ slots: SLOTS, departments: departments.rows, categories: categories.rows, projects: projects.rows, reviewers: reviewers.rows });
}));

export default r;
