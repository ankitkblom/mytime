import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';
import { seedReference } from './seed-data.js';

await seedReference(pool);
const dept = (await pool.query("SELECT id FROM departments WHERE code = 'IT-004'")).rows[0].id;
const pw = config.adminPassword;
if (!pw || pw.length < 10) console.warn('ADMIN_PASSWORD not set (>=10 chars): admin will use "Set password" via email code');
await pool.query(
  `INSERT INTO users(emp_id, name, email, department_id, designation, role, password_hash)
   VALUES ('ADMIN-1','Ankit Kumar',$1,$2,'Admin','admin',$3) ON CONFLICT (email) DO NOTHING`,
  [config.adminEmail.toLowerCase(), dept, pw && pw.length >= 10 ? await bcrypt.hash(pw, 12) : null]);
console.log('seeded');
if (process.argv[1].endsWith('seed.js')) await pool.end();
