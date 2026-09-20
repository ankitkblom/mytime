import fs from 'node:fs';
import { pool } from '../src/db.js';

await pool.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('schema applied');
if (process.argv[1].endsWith('migrate.js')) await pool.end();
