import fs from 'node:fs';

const value = (key, value) => ({ key, value });
const secret = key => ({ key, sync: false });
const from = (key, name, envVarKey) => ({ key, fromService: { type: 'web', name, envVarKey } });
const mongo = from('MONGO_URI', 'noir-usuarios', 'MONGO_URI');
const jwt = from('JWT_SECRET', 'noir-usuarios', 'JWT_SECRET');
const internal = from('INTERNAL_SERVICE_SECRET', 'noir-inventario', 'INTERNAL_SERVICE_SECRET');
const common = [value('NODE_ENV', 'production'), value('NODE_VERSION', '24'), value('SERVICE_TIMEOUT_MS', '180000')];
const service = (name, startCommand, envVars) => ({
  type: 'web', name, runtime: 'node', plan: 'free',
  buildCommand: 'npm ci', startCommand, healthCheckPath: '/health',
  envVars: [...common, ...envVars],
});
const blueprint = { services: [
  service('noir-usuarios', 'npm run start:users', [secret('MONGO_URI'), secret('JWT_SECRET'), value('MONGO_USERS_DB', 'noir_usuarios')]),
  service('noir-inventario', 'npm run start:stock', [mongo, secret('INTERNAL_SERVICE_SECRET'), value('MONGO_STOCK_DB', 'noir_inventario')]),
  service('noir-productos', 'npm run start:products', [mongo, jwt, internal, value('MONGO_PRODUCTS_DB', 'noir_productos'), from('STOCK_SERVICE_URL', 'noir-inventario', 'RENDER_EXTERNAL_URL')]),
  service('proyecto-noir', 'npm start', [mongo, jwt, { key: 'SESSION_SECRET', generateValue: true }, value('CONTENT_ENABLED', 'false'),
    from('USERS_SERVICE_URL', 'noir-usuarios', 'RENDER_EXTERNAL_URL'),
    from('PRODUCTS_SERVICE_URL', 'noir-productos', 'RENDER_EXTERNAL_URL'),
    from('STOCK_SERVICE_URL', 'noir-inventario', 'RENDER_EXTERNAL_URL'),
  ]),
] };
// JSON is valid YAML. Keeping this form allows validation with Node alone.
const output = JSON.stringify(blueprint, null, 2) + '\n';
const target = new URL('../render.yaml', import.meta.url);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('render.yaml no coincide con su generador');
  console.log('Blueprint coherente: cuatro Web Services Free, HTTPS público, sin secretos incluidos.');
} else {
  fs.writeFileSync(target, output);
}
