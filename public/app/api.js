export async function getJSON(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path.startsWith('/api/telemetry/history?') ? 60000 : 18000);
  try {
    const res = await fetch(path, { ...options, signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `No se pudo completar la consulta (${res.status}).`);
    }
    return await res.json();
  } finally { clearTimeout(timer); }
}
