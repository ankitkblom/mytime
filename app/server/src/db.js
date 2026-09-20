import pg from 'pg';
import { config } from './config.js';

// DATE columns come back as 'YYYY-MM-DD' strings, not JS Dates (avoids timezone shifts)
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
export const q = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export const audit = (actorId, action, detail = {}, client = pool) =>
  client.query('INSERT INTO audit_log(actor_id, action, detail) VALUES ($1,$2,$3)', [actorId, action, detail]);
