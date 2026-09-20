export function serviceDatabase(service, env = process.env) {
  const prefix = { users: 'USERS', products: 'PRODUCTS', stock: 'STOCK' }[service];
  if (!prefix) throw new Error('Servicio desconocido');
  const defaults = { users: 'noir_users', products: 'noir_products', stock: 'noir_inventory' };
  return {
    uri: env[`MONGO_${prefix}_URI`] || env.MONGO_URI,
    dbName: env[`MONGO_${prefix}_DB`] || defaults[service],
  };
}
