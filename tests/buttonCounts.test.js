import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountsHandler } from '../scripts/button-counts.mjs';

async function request(handler, { method = 'GET', url = '/api/button-click-counts' } = {}) {
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } };
  let next = false;
  await handler({ method, url }, response, () => { next = true; });
  return { ...response, next };
}

test('keeps menus separate, returns zero-capable empty counts, and reuses then refreshes cached results', async () => {
  let time = 100;
  let calls = 0;
  const handler = createCountsHandler({ now: () => time, readCounts: async () => {
    calls++;
    return [{ menu: 'users', button: 'export_csv', count: '7' }, { menu: 'products', button: 'export_csv', count: '2' }];
  } });
  const first = await request(handler);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.counts.users.export_csv, 7);
  assert.equal(first.body.counts.products.export_csv, 2);
  await request(handler);
  assert.equal(calls, 1);
  time += 5001;
  await request(handler);
  assert.equal(calls, 2);
  const empty = await request(createCountsHandler({ readCounts: async () => [] }));
  assert.deepEqual(empty.body.counts, {});
});

test('reports unavailable statistics without exposing database errors or returning misleading zero counts', async () => {
  const handler = createCountsHandler({ readCounts: async () => { throw Error('database secret'); } });
  const result = await request(handler);
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.counts, undefined);
  assert.ok(!JSON.stringify(result.body).includes('database secret'));
});

test('only serves the exact endpoint and rejects mutation requests', async () => {
  let calls = 0;
  const handler = createCountsHandler({ readCounts: async () => { calls++; return []; } });
  assert.equal((await request(handler, { url: '/api/button-click-counts-other' })).next, true);
  assert.equal((await request(handler, { method: 'POST' })).statusCode, 405);
  assert.equal(calls, 0);
});

test('shares one query across concurrent hovers and recovers after a failed refresh', async () => {
  let resolve;
  let calls = 0;
  let time = 100;
  let fail = false;
  const handler = createCountsHandler({ now: () => time, readCounts: async () => {
    calls++;
    if (fail) throw Error('offline');
    return new Promise(done => { resolve = done; });
  } });
  const first = request(handler);
  const second = request(handler);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve([{ menu: 'users', button: 'delete_row', count: '3' }]);
  assert.equal((await first).body.counts.users.delete_row, 3);
  assert.equal((await second).body.counts.users.delete_row, 3);
  time += 5001;
  fail = true;
  assert.equal((await request(handler)).statusCode, 503);
  fail = false;
  const recovered = request(handler);
  await Promise.resolve();
  resolve([{ menu: 'users', button: 'delete_row', count: '4' }]);
  assert.equal((await recovered).body.counts.users.delete_row, 4);
});
