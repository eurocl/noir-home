let catalog = new Map();
let expiresAt = 0;
let lastCatalog;

export function rememberCatalog(products) {
  catalog = new Map(products.map(product => [String(product._id), product]));
  expiresAt = Date.now() + 60_000;
  lastCatalog = products;
}

export function getLastCatalog() {
  return Date.now() < expiresAt + 15 * 60_000 ? lastCatalog : undefined;
}

export function findRecentProduct(id) {
  return getLastCatalog() ? catalog.get(id) : undefined;
}
