let catalog = new Map();
let expiresAt = 0;

export function rememberCatalog(products) {
  catalog = new Map(products.map(product => [String(product._id), product]));
  expiresAt = Date.now() + 60_000;
}

export function findRecentProduct(id) {
  return Date.now() < expiresAt ? catalog.get(id) : undefined;
}
