import fs from 'node:fs/promises';
import dns from 'node:dns';
import net from 'node:net';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { serviceDatabase } from '../services/database-config.js';

const { EJSON } = mongoose.mongo.BSON;
const envPath = new URL('../.env', import.meta.url);
const rawEnv = await fs.readFile(envPath, 'utf8');
const env = dotenv.parse(rawEnv);
if (env.MONGO_DNS_SERVERS) dns.setServers(env.MONGO_DNS_SERVERS.split(',').map(value => value.trim()));
const apply = process.argv.includes('--apply');
const client = new mongoose.mongo.MongoClient(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function canonical(value) { return JSON.stringify(stable(EJSON.serialize(value, { relaxed: false }))); }
function digest(docs) { return crypto.createHash('sha256').update(canonical([...docs].sort((a, b) => String(a._id).localeCompare(String(b._id))))).digest('hex'); }
async function snapshot(db) {
  const result = {};
  for (const name of ['users', 'products', 'carts']) result[name] = await db.collection(name).find().toArray();
  return result;
}
async function listening(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}
try {
  if (apply) {
    for (const port of [env.PORT || 3000, env.USERS_PORT || 3001, env.PRODUCTS_PORT || 3002, env.STOCK_PORT || 3003]) {
      if (await listening(Number(port))) throw new Error(`Detené los servicios locales antes de migrar; el puerto ${port} está activo.`);
    }
  }
  await client.connect();
  const source = client.db();
  const original = await snapshot(source);
  if (!original.products.length || !original.users.length) throw new Error('La base de origen no tiene el catálogo o usuarios esperados.');
  const emailUsers = original.users.filter(user => typeof user.email === 'string');
  if (new Set(emailUsers.map(user => user.email)).size !== emailUsers.length) throw new Error('Hay correos duplicados; resolverlos antes de crear el índice único.');
  if (original.products.some(product => product.stock !== undefined && (!Number.isSafeInteger(product.stock) || product.stock < 0))) throw new Error('Hay existencias inválidas en el origen.');
  const configs = ['users', 'products', 'stock'].map(service => ({ service, ...serviceDatabase(service, env) }));
  if (configs.some(config => config.uri !== env.MONGO_URI)) throw new Error('Esta migración requiere destinos en el mismo clúster y URI de origen.');
  if (new Set([source.databaseName, ...configs.map(config => config.dbName)]).size !== 4) throw new Error('Las tres bases de destino deben ser distintas entre sí y del origen.');
  const plan = [
    { ...configs[0], collection: 'users', docs: original.users },
    { ...configs[1], collection: 'products', docs: original.products.map(({ stock, ...product }) => product) },
    { ...configs[2], collection: 'inventory', docs: original.products.map(product => ({ _id: product._id, stock: product.stock ?? 0 })) },
  ];
  // Inspect every target before writing anything; existing differing data is never overwritten.
  for (const target of plan) {
    const existing = await client.db(target.dbName).collection(target.collection).find().toArray();
    const expected = new Map(target.docs.map(doc => [String(doc._id), doc]));
    for (const doc of existing) {
      if (!expected.has(String(doc._id)) || canonical(doc) !== canonical(expected.get(String(doc._id)))) throw new Error(`Conflicto en ${target.dbName}.${target.collection}; no se sobrescriben registros.`);
    }
    const ids = new Set(existing.map(doc => String(doc._id)));
    target.missing = target.docs.filter(doc => !ids.has(String(doc._id)));
  }
  console.log(JSON.stringify({ source: source.databaseName, mode: apply ? 'apply' : 'check', targets: plan.map(({ dbName, collection, docs, missing }) => ({ database: dbName, collection, count: docs.length, toInsert: missing.length })), cartsPreserved: original.carts.length }, null, 2));
  if (apply) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = new URL(`../backups/database-separation-${stamp}/`, import.meta.url);
    await fs.mkdir(backup, { recursive: true });
    await fs.writeFile(new URL('original.env', backup), rawEnv, { flag: 'wx', mode: 0o600 });
    await fs.writeFile(new URL('source.ejson', backup), EJSON.stringify(original, { relaxed: false }), { flag: 'wx', mode: 0o600 });
    const indexes = {};
    for (const name of ['users', 'products', 'carts']) indexes[name] = await source.collection(name).listIndexes().toArray();
    await fs.writeFile(new URL('indexes.ejson', backup), EJSON.stringify(indexes), { flag: 'wx', mode: 0o600 });
    const manifest = { source: source.databaseName, backup: `backups/database-separation-${stamp}`, state: 'backed-up', targets: plan.map(({ dbName, collection, docs }) => ({ database: dbName, collection, count: docs.length, sha256: digest(docs) })), sourceHashes: Object.fromEntries(Object.entries(original).map(([name, docs]) => [name, digest(docs)])) };
    const saveManifest = () => fs.writeFile(new URL('manifest.json', backup), JSON.stringify(manifest, null, 2));
    await saveManifest();
    for (const target of plan) {
      const collection = client.db(target.dbName).collection(target.collection);
      if (target.missing.length) await collection.insertMany(target.missing, { ordered: true });
      if (target.collection === 'users') await collection.createIndex({ email: 1 }, { unique: true, name: 'email_1', partialFilterExpression: { email: { $type: 'string' } } });
      const copied = await collection.find().toArray();
      if (digest(copied) !== digest(target.docs)) throw new Error(`Falló la verificación completa de ${target.dbName}.`);
    }
    const after = await snapshot(source);
    for (const name of Object.keys(original)) if (digest(original[name]) !== digest(after[name])) throw new Error('El origen cambió durante la migración; no se activan los destinos.');
    manifest.state = 'verified';
    await saveManifest();
    if (await fs.readFile(envPath, 'utf8') !== rawEnv) throw new Error('El .env cambió durante la migración; no se reemplaza.');
    let nextEnv = rawEnv.trimEnd() + '\n';
    const settings = {
      MONGO_USERS_DB: configs[0].dbName,
      MONGO_PRODUCTS_DB: configs[1].dbName,
      MONGO_STOCK_DB: configs[2].dbName,
      INTERNAL_SERVICE_SECRET: env.INTERNAL_SERVICE_SECRET || crypto.randomBytes(32).toString('hex'),
      CONTENT_ENABLED: env.CONTENT_ENABLED || 'false',
    };
    for (const [key, value] of Object.entries(settings)) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      nextEnv = pattern.test(nextEnv) ? nextEnv.replace(pattern, `${key}=${value}`) : nextEnv + `${key}=${value}\n`;
    }
    const tempEnv = new URL('../.env.migration-tmp', import.meta.url);
    await fs.writeFile(tempEnv, nextEnv, { flag: 'wx', mode: 0o600 });
    await fs.rename(tempEnv, envPath);
    manifest.state = 'activated';
    await saveManifest();
    console.log(`Migración verificada y activada. Respaldo: ${manifest.backup}. El origen se conservó íntegro.`);
  }
} catch (error) {
  // Do not print connection URIs, user documents or password hashes on failures.
  const safe = error.name === 'Error' && !/mongodb|password|credential/i.test(error.message) ? error.message : `${error.name} (${error.code || 'sin código'})`;
  console.error(safe);
  process.exitCode = 1;
} finally { await client.close(); }
