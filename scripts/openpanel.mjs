import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'infra/openpanel');
const envPath = path.join(directory, '.env');
const action = process.argv[2] || 'up';
const secret = () => randomBytes(32).toString('hex');
const quoteSql = value => `'${String(value).replaceAll("'", "''")}'`;

function setup() {
  if (!existsSync(envPath)) {
    const password = secret();
    const dbUrl = `postgresql://postgres:${password}@op-db:5432/postgres?schema=public`;
    const config = {
      NODE_ENV: 'production', SELF_HOSTED: 'true',
      BATCH_SIZE: '5000', BATCH_INTERVAL: '1000',
      ALLOW_REGISTRATION: 'false', ALLOW_INVITATION: 'false',
      POSTGRES_PASSWORD: password,
      DATABASE_URL: dbUrl, DATABASE_URL_DIRECT: dbUrl,
      REDIS_URL: 'redis://op-kv:6379', CLICKHOUSE_URL: 'http://op-ch:8123/openpanel',
      DASHBOARD_URL: 'http://localhost:3001', API_URL: 'http://localhost:3001/api',
      API_URL_SSR: 'http://op-api:3000',
      NEXT_PUBLIC_DASHBOARD_URL: 'http://localhost:3001', NEXT_PUBLIC_API_URL: 'http://localhost:3001/api',
      COOKIE_SECRET: secret(), ENCRYPTION_KEY: secret(),
      OP_ORGANIZATION_ID: randomUUID(), OP_PROJECT_ID: randomUUID(), OP_CLIENT_ID: randomUUID(),
      OP_ADMIN_EMAIL: 'admin@example.com', OP_ADMIN_PASSWORD: secret(),
    };
    writeFileSync(envPath, Object.entries(config).map(([key, value]) => `${key}="${value}"`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  }
  const config = parseEnv(readFileSync(envPath, 'utf8'));
  const clientEnvPath = path.join(root, '.env.local');
  let clientEnv = existsSync(clientEnvPath) ? readFileSync(clientEnvPath, 'utf8') : '';
  const browserConfig = { VITE_OPENPANEL_CLIENT_ID: config.OP_CLIENT_ID, VITE_OPENPANEL_API_URL: config.API_URL };
  for (const [key, value] of Object.entries(browserConfig)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    clientEnv = pattern.test(clientEnv) ? clientEnv.replace(pattern, `${key}=${value}`) : `${clientEnv.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(clientEnvPath, clientEnv.trimStart(), { mode: 0o600 });
  return config;
}

function compose(args, { input, capture = false } = {}) {
  const result = spawnSync('docker', ['compose', '--project-directory', directory, '--env-file', envPath, '-f', path.join(directory, 'compose.yaml'), ...args], {
    cwd: root, input, encoding: 'utf8', stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    // Do not echo SQL, passwords or full container environment on failure.
    throw new Error(`docker compose ${args[0]} 실패. Docker 접근 권한과 npm run openpanel:logs 출력을 확인하세요.`);
  }
  return result.stdout?.trim() || '';
}
function sql(query) {
  return compose(['exec', '-T', 'op-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: query, capture: true });
}

async function bootstrap(config) {
  const email = quoteSql(config.OP_ADMIN_EMAIL);
  let userId = sql(`SELECT id FROM users WHERE email = ${email};`);
  if (!userId) {
    // Use OpenPanel's own registration endpoint so its password hashing stays authoritative.
    const response = await fetch(`${config.API_URL}/trpc/auth.signUpEmail`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: config.DASHBOARD_URL },
      body: JSON.stringify({ json: { email: config.OP_ADMIN_EMAIL, password: config.OP_ADMIN_PASSWORD, confirmPassword: config.OP_ADMIN_PASSWORD, firstName: 'Panel', lastName: 'Admin' } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`OpenPanel 관리자 등록 실패 (HTTP ${response.status}). 기존 사용자가 있다면 infra/openpanel/.env의 OP_ADMIN_EMAIL을 기존 계정으로 지정한 후 npm run openpanel:bootstrap을 실행하세요.`);
    userId = sql(`SELECT id FROM users WHERE email = ${email};`);
    if (!userId) throw new Error('등록 결과를 확인할 수 없습니다. npm run openpanel:bootstrap으로 재시도하세요.');
  }
  const org = quoteSql(config.OP_ORGANIZATION_ID);
  const project = quoteSql(config.OP_PROJECT_ID);
  const client = quoteSql(config.OP_CLIENT_ID);
  const user = quoteSql(userId);
  sql(`BEGIN;
INSERT INTO organizations (id, name, "createdAt", "updatedAt")
VALUES (${org}, 'Test Panel', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO members (id, role, email, "userId", "organizationId", "createdAt", "updatedAt")
VALUES (${quoteSql(randomUUID())}, 'org:admin', ${email}, ${user}, ${org}, NOW(), NOW())
ON CONFLICT ("organizationId", "userId") DO NOTHING;
INSERT INTO projects (id, name, "organizationId", types, domain, cors, "createdAt", "updatedAt")
VALUES (${project}, 'Test Panel', ${org}, ARRAY['website']::"ProjectType"[], 'http://localhost:5173', ARRAY['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'], NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO clients (id, name, type, "projectId", "organizationId", "ignoreCorsAndSecret", "createdAt", "updatedAt")
VALUES (${client}, 'Test Panel Browser', 'write', ${project}, ${org}, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;`);
  console.log('관리자 계정, Test Panel 프로젝트, 브라우저 Client 연결을 확인했습니다.');
  console.log(`OpenPanel: ${config.DASHBOARD_URL}`);
  console.log('로그인 정보: infra/openpanel/.env의 OP_ADMIN_EMAIL / OP_ADMIN_PASSWORD (Git 제외)');
  console.log('앱의 Vite 서버를 재시작한 뒤 메뉴와 버튼을 사용해 보세요.');
}

try {
  const config = setup();
  if (action === 'setup') {
    console.log('서버 설정과 .env.local을 준비했습니다. 기존 비밀번호와 ID는 유지합니다.');
  } else if (action === 'up') {
    console.log('OpenPanel 2.x 이미지와 데이터베이스를 시작합니다. 최초 실행은 이미지 다운로드와 DB 마이그레이션으로 시간이 걸릴 수 있습니다.');
    compose(['up', '-d', '--wait', '--wait-timeout', '600']);
    await bootstrap(config);
  } else if (action === 'bootstrap') {
    await bootstrap(config);
  } else if (action === 'down') {
    compose(['down']);
  } else if (action === 'logs') {
    compose(['logs', '--tail', '100', '-f']);
  } else if (action === 'status') {
    compose(['ps']);
  } else if (action === 'config') {
    compose(['config', '--quiet']);
  } else {
    throw new Error(`지원하지 않는 명령: ${action}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
