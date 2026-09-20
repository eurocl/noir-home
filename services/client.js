import { setTimeout as delay } from 'node:timers/promises';
import { serviceTimeout } from './deployment.js';

export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function requestService(service, path, { method = "GET", body, token, internal = false } = {}) {
  const services = {
    users: [process.env.USERS_SERVICE_URL || "http://127.0.0.1:3001", "usuarios"],
    products: [process.env.PRODUCTS_SERVICE_URL || "http://127.0.0.1:3002", "productos"],
    stock: [process.env.STOCK_SERVICE_URL || "http://127.0.0.1:3003", "stock"],
  };
  const [base, label] = services[service];
  const onRender = process.env.RENDER === 'true';
  const signal = AbortSignal.timeout(serviceTimeout());
  async function fetchJson(url, options, readiness = false) {
    while (true) {
      try {
        const response = await fetch(url, { ...options, signal, redirect: 'error' });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { /* Render can return an HTML loading page. */ }
        const transient = [502, 503, 504].includes(response.status) || (response.ok && data === undefined);
        if (onRender && options.method === 'GET' && (transient || (readiness && response.ok && data?.ready !== true))) {
          await delay(500, undefined, { signal });
          continue;
        }
        if (!response.ok) throw new ServiceError(response.status, data?.message || `El servicio de ${label} no está disponible`);
        if (data === undefined) throw new ServiceError(503, `El servicio de ${label} todavía no está disponible`);
        return data;
      } catch (error) {
        if (error instanceof ServiceError || signal.aborted || !onRender || options.method !== 'GET') throw error;
        await delay(500, undefined, { signal });
      }
    }
  }
  try {
    // Wake a sleeping service with a safe read before sending a mutation once.
    if (onRender && method !== 'GET') await fetchJson(new URL('/health', base), { method: 'GET' }, true);
    return await fetchJson(new URL(path, base), {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(internal ? { "X-Service-Key": process.env.INTERNAL_SERVICE_SECRET || "" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(503, `El servicio de ${label} no está disponible. Intentá nuevamente.`);
  }
}
