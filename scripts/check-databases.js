import fs from 'node:fs';
import dns from 'node:dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { serviceDatabase } from '../services/database-config.js';

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
if (env.MONGO_DNS_SERVERS) dns.setServers(env.MONGO_DNS_SERVERS.split(',').map(value => value.trim()));
const deadline = setTimeout(() => {
  console.log('TIMEOUT: database diagnostics exceeded 45 seconds');
  process.exit(1);
}, 45000);
try {
  const targets = ['users', 'products', 'stock'].map(key => ({ key, ...serviceDatabase(key, env) }));
  targets.push({ key: 'cart', uri: env.MONGO_URI });
  if (env.MONGO_CONTENT_URI && env.CONTENT_ENABLED !== 'false') targets.push({ key: 'external-content', uri: env.MONGO_CONTENT_URI });
  await Promise.all(targets.map(async ({ key, uri, dbName }) => {
    const connection = mongoose.createConnection();
    try {
      await connection.openUri(uri, { dbName, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 8000, autoCreate: false, autoIndex: false });
      await connection.db.command({ ping: 1 });
      console.log(`${key}: CONNECTED; ping OK`);
    } catch (error) {
      const details = [...(error.reason?.servers?.values() || [])].map(server => ({
        type: server.type,
        error: server.error?.name,
        code: server.error?.code,
        cause: server.error?.cause?.code,
      }));
      console.log(JSON.stringify({ key, status: 'FAILED', error: error.name, code: error.code, details }));
    } finally {
      await connection.close();
    }
  }));
} finally {
  clearTimeout(deadline);
}
