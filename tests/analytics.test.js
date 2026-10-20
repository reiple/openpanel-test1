import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelAnalytics, createOpenPanelTransport } from '../src/analytics.js';

test('counts initial and return visits but ignores repeated renders and active-menu clicks', () => {
  const events = [];
  const analytics = createPanelAnalytics((name, properties) => events.push({ name, properties }));
  analytics.visit('dashboard');
  analytics.visit('dashboard');
  analytics.visit('users');
  analytics.visit('dashboard');
  assert.deepEqual(events.filter(e => e.name === 'menu_view').map(e => e.properties.menu), ['dashboard', 'users', 'dashboard']);
  assert.equal(events.filter(e => e.name === 'screen_view').length, 3);
});

test('table render deduplication includes query, page, menu and data revision, never sends raw data', () => {
  const events = [];
  const analytics = createPanelAnalytics((name, properties) => events.push({ name, properties }));
  const table = { menu: 'users', query: '', page: 0, pageSize: 5, totalRows: 4, revision: 0 };
  analytics.table(table);
  analytics.table(table);
  analytics.table({ ...table, query: 'private@example.com', totalRows: 0 });
  analytics.table({ ...table, query: 'private@example.com', totalRows: 0, page: 1 });
  analytics.table({ ...table, query: 'private@example.com', totalRows: 0, page: 1, revision: 1 });
  assert.equal(events.length, 4);
  assert.deepEqual(events.map(e => e.properties.reason), ['menu_enter', 'search', 'pagination', 'data_change']);
  assert.ok(!JSON.stringify(events).includes('private@example.com'));
  assert.equal(events[1].properties.has_search, true);
  assert.equal(events[0].properties.visible_rows, 4);
});

test('buttons use stable IDs and preserve the source screen', () => {
  const events = [];
  const analytics = createPanelAnalytics((name, properties) => events.push({ name, properties }));
  analytics.button('users', 'delete_row');
  analytics.button('dashboard', 'navigate_users');
  assert.deepEqual(events.map(e => [e.name, e.properties.menu, e.properties.button]), [
    ['button_click', 'users', 'delete_row'], ['button_click', 'dashboard', 'navigate_users'],
  ]);
});

test('transport sends OpenPanel track envelope and public client ID without secrets', async () => {
  let request;
  const send = createOpenPanelTransport({ clientId: 'public-client', apiUrl: 'http://localhost:3001/api/', fetcher: async (...args) => { request = args; return { ok: true }; } });
  assert.equal(await send('menu_view', { menu: 'users' }), true);
  assert.equal(request[0], 'http://localhost:3001/api/track');
  assert.equal(request[1].headers['openpanel-client-id'], 'public-client');
  assert.equal(request[1].headers['openpanel-client-secret'], undefined);
  assert.equal(request[1].keepalive, true);
  assert.deepEqual(JSON.parse(request[1].body).payload.name, 'menu_view');
});

test('missing configuration and unreachable or rejecting analytics never break app actions', async () => {
  let calls = 0;
  assert.equal(await createOpenPanelTransport({ fetcher: () => calls++ })('menu_view', {}), false);
  assert.equal(calls, 0);
  assert.equal(await createOpenPanelTransport({ clientId: 'x', fetcher: async () => { throw new Error('offline'); } })('menu_view', {}), false);
  assert.equal(await createOpenPanelTransport({ clientId: 'x', fetcher: async () => ({ ok: false }) })('menu_view', {}), false);
});
