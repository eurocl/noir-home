export function listenOptions(localPort, env = process.env) {
  const render = env.RENDER === 'true';
  const port = Number(render ? env.PORT || 10000 : localPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido');
  return { port, host: render ? '0.0.0.0' : '127.0.0.1' };
}

export function serviceTimeout(env = process.env) {
  const value = Number(env.SERVICE_TIMEOUT_MS || (env.RENDER === 'true' ? 180000 : 10000));
  if (!Number.isInteger(value) || value < 1 || value > 300000) throw new Error('SERVICE_TIMEOUT_MS debe estar entre 1 y 300000');
  return value;
}

export function validateServiceUrls(services, env = process.env) {
  if (env.RENDER !== 'true') return;
  for (const service of services) {
    const key = `${service.toUpperCase()}_SERVICE_URL`;
    let url;
    try { url = new URL(env[key]); } catch { throw new Error(`Falta configurar ${key}`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`${key} debe ser una URL base HTTPS sin credenciales ni rutas`);
    }
  }
}
