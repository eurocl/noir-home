export function serviceDatabase(service, env = process.env) {
  const prefix = { users: 'USERS', products: 'PRODUCTS', stock: 'STOCK' }[service];
  if (!prefix) throw new Error('Servicio desconocido');
  const defaults = { users: 'noir_usuarios', products: 'noir_productos', stock: 'noir_inventario' };
  return {
    uri: env[`MONGO_${prefix}_URI`] || env.MONGO_URI,
    dbName: env[`MONGO_${prefix}_DB`] || defaults[service],
  };
}
