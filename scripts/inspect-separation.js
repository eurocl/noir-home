import fs from 'node:fs';
import dns from 'node:dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
if (env.MONGO_DNS_SERVERS) dns.setServers(env.MONGO_DNS_SERVERS.split(',').map(value => value.trim()));
const client = new mongoose.mongo.MongoClient(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const source = client.db();
  const collections = {};
  for (const name of ['users', 'products', 'carts']) {
    collections[name] = { count: await source.collection(name).countDocuments(), indexes: await source.collection(name).listIndexes().toArray() };
  }
  const products = await source.collection('products').find({}, { projection: { stock: 1 } }).toArray();
  const invalidStock = products.filter(item => item.stock !== undefined && (!Number.isSafeInteger(item.stock) || item.stock < 0)).length;
  const userShapes = await source.collection('users').find().toArray();
  const accountSummary = userShapes.map(user => ({ fields: Object.keys(user), emailType: typeof user.email, passwordType: typeof user.password }));
  const targets = {};
  for (const name of ['noir_users', 'noir_products', 'noir_inventory']) {
    targets[name] = (await client.db(name).listCollections({}, { nameOnly: true }).toArray()).map(item => item.name);
  }
  console.log(JSON.stringify({ source: source.databaseName, collections, invalidStock, accountSummary, targets }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.name, code: error.code }));
  process.exitCode = 1;
} finally { await client.close(); }
