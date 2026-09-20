import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listenOptions, serviceTimeout, validateServiceUrls } from '../services/deployment.js';
import { requestService } from '../services/client.js';

function renderEnv(t, extra = {}) {
  const settings = { RENDER: 'true', SERVICE_TIMEOUT_MS: '3000', USERS_SERVICE_URL: 'https://users.example.test', ...extra };
  const old = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => { for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value; });
}

test('Render listens on the platform port while local services keep distinct ports', () => {
  assert.deepEqual(listenOptions(3001, { PORT: '3000' }), { port: 3001, host: '127.0.0.1' });
  assert.deepEqual(listenOptions(3001, { RENDER: 'true', PORT: '12345' }), { port: 12345, host: '0.0.0.0' });
  assert.deepEqual(listenOptions(3002, { RENDER: 'true' }), { port: 10000, host: '0.0.0.0' });
  assert.equal(serviceTimeout({ RENDER: 'true' }), 180000);
  assert.equal(serviceTimeout({}), 10000);
  assert.throws(() => serviceTimeout({ SERVICE_TIMEOUT_MS: 'bad' }));
  assert.throws(() => listenOptions(3001, { RENDER: 'true', PORT: 'no' }));
  assert.throws(() => validateServiceUrls(['stock'], { RENDER: 'true' }));
  assert.throws(() => validateServiceUrls(['stock'], { RENDER: 'true', STOCK_SERVICE_URL: 'http://localhost:3003' }));
  validateServiceUrls(['stock'], { RENDER: 'true', STOCK_SERVICE_URL: 'https://stock.example.test' });
});

test('cold GET tolerates the Render loading page and temporary 503', async t => {
  renderEnv(t);
  const responses = [new Response('<html>Loading</html>'), Response.json({ message: 'Starting' }, { status: 503 }), Response.json({ id: 'ready' })];
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => responses[calls++]);
  assert.deepEqual(await requestService('users', '/users/me'), { id: 'ready' });
  assert.equal(calls, 3);
});

test('mutations wake via health, send once and never retry server errors', async t => {
  renderEnv(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ path: url.pathname, ...options });
    if (url.pathname === '/health') return Response.json({ ready: true });
    return Response.json({ message: 'Creation failed' }, { status: 500 });
  });
  await assert.rejects(requestService('users', '/users/register', { method: 'POST', body: { name: 'Test' } }), error => error.status === 500);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'POST']);
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[1].redirect, 'error');
});

test('an ambiguous mutation network failure is not repeated', async t => {
  renderEnv(t);
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'GET') return Response.json({ ready: true });
    writes++;
    throw new TypeError('Connection interrupted');
  });
  await assert.rejects(requestService('users', '/users/register', { method: 'POST', body: {} }), error => error.status === 503);
  assert.equal(writes, 1);
});

test('cold-start retries have a finite overall deadline', async t => {
  renderEnv(t, { SERVICE_TIMEOUT_MS: '20' });
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method !== 'GET') writes++;
    return new Response('Starting', { status: 503 });
  });
  await assert.rejects(requestService('users', '/users/register', { method: 'POST', body: {} }), error => error.status === 503);
  assert.equal(writes, 0);
});

test('Blueprint uses four free services and public URLs with no dependency cycles', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../render.yaml', import.meta.url)));
  assert.equal(config.services.length, 4);
  const byName = new Map(config.services.map(service => [service.name, service]));
  const visiting = new Set();
  const done = new Set();
  function visit(service) {
    if (done.has(service.name)) return;
    assert.ok(!visiting.has(service.name), 'dependency cycle');
    visiting.add(service.name);
    for (const item of service.envVars) {
      if (item.fromService) {
        assert.ok(byName.has(item.fromService.name));
        assert.notEqual(item.fromService.property, 'host');
        if (item.key.endsWith('_SERVICE_URL')) assert.equal(item.fromService.envVarKey, 'RENDER_EXTERNAL_URL');
        visit(byName.get(item.fromService.name));
      }
      if (/SECRET|MONGO_URI/.test(item.key)) assert.equal(item.value, undefined);
    }
    visiting.delete(service.name);
    done.add(service.name);
  }
  for (const service of config.services) {
    assert.equal(service.type, 'web');
    assert.equal(service.plan, 'free');
    assert.equal(service.healthCheckPath, '/health');
    assert.ok(!service.startCommand.includes('start:all'));
    visit(service);
  }
});
