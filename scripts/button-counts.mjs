import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseEnv } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const composePath = fileURLToPath(new URL('../infra/openpanel/compose.yaml', import.meta.url));
const envPath = fileURLToPath(new URL('../infra/openpanel/.env', import.meta.url));

async function readOpenPanelCounts() {
  const { OP_PROJECT_ID: project } = parseEnv(await readFile(envPath, 'utf8'));
  if (!/^[a-f0-9-]{36}$/i.test(project ?? '')) throw new Error('Missing project configuration');
  // Query retained OpenPanel events, never browser-supplied SQL or identifiers.
  const query = `SELECT properties['menu'] AS menu, properties['button'] AS button,
    count() AS count FROM openpanel.events
    WHERE project_id = {project:String} AND name = 'button_click'
    GROUP BY menu, button FORMAT JSONEachRow`;
  const { stdout } = await exec('docker', ['compose', '-f', composePath, 'exec', '-T', 'op-ch',
    'clickhouse-client', '--readonly=1', '--max_execution_time=3', `--param_project=${project}`, '--query', query],
  { timeout: 4500, maxBuffer: 1024 * 1024 });
  return stdout.trim() ? stdout.trim().split('\n').map(line => JSON.parse(line)) : [];
}

export function createCountsHandler({ readCounts = readOpenPanelCounts, now = Date.now } = {}) {
  let cache;
  let expires = 0;
  let pending;
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/button-click-counts') return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    try {
      if (!cache || now() >= expires) {
        pending ??= Promise.resolve().then(readCounts).then(rows => {
          const counts = Object.create(null);
          for (const row of rows) {
            if (!['dashboard', 'users', 'products'].includes(row.menu) || !/^[a-z_]+$/.test(row.button)) continue;
            (counts[row.menu] ??= Object.create(null))[row.button] = Number(row.count);
          }
          cache = { counts, updatedAt: new Date(now()).toISOString() };
          expires = now() + 5000;
        }).finally(() => { pending = undefined; });
        await pending;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(cache));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: '통계 조회 불가' }));
    }
  };
}

export function buttonCountsPlugin() {
  return {
    name: 'openpanel-button-counts',
    configureServer(server) { server.middlewares.use(createCountsHandler()); },
    configurePreviewServer(server) { server.middlewares.use(createCountsHandler()); },
  };
}
