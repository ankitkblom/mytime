import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = createApp().listen(config.port, () => console.log(`Bloom Timesheet on :${config.port} (${config.isProd ? 'production' : 'dev'})`));
const stop = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
