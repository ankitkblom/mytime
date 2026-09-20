// Local dev: boots an embedded PostgreSQL (no install needed), applies schema + seed, starts the API.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';

const dir = new URL('../.pgdata', import.meta.url).pathname;
const fresh = !fs.existsSync(dir);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: 5433, persistent: true });
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('bloom');
process.env.DATABASE_URL ||= 'postgres://postgres:postgres@localhost:5433/bloom';
process.env.ADMIN_PASSWORD ||= 'ChangeMe-12345';
process.env.DEV_SHOW_OTP ||= '1';
await import('./migrate.js');
await import('./seed.js');
await import('../src/index.js');
process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
