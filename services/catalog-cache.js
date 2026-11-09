import snapshot from './catalog-snapshot.json' with { type: 'json' };

let catalog = new Map();
let expiresAt = 0;
let lastCatalog;

export function rememberCatalog(products) {
  catalog = new Map(products.map(product => [String(product._id), product]));
  expiresAt = Date.now() + 60_000;
  lastCatalog = products;
}

export function getLastCatalog() {
  return lastCatalog ?? snapshot;
}

export function findRecentProduct(id) {
  return Date.now() < expiresAt ? catalog.get(id) : undefined;
}
export function findDisplayProduct(id) {
  return getLastCatalog().find(product => String(product._id) === id);
}
