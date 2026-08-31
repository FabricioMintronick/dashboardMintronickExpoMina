'use strict';
const { normalizeEquipment, SIGNALS } = require('../domain/telemetry');

function registerFleetRoutes(app, { getDb, getGateways, collection, catalog, staleMs }) {
  let snapshot = null, cachedAt = 0, pending = null;
  async function readFleet() {
    if (snapshot && Date.now() - cachedAt < 5000) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      const db = getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const col = db.collection(collection);
      const gateways = getGateways().filter(g => typeof g === 'string');
      const known = new Map(catalog.map(item => [item.gateway, item]));
      const all = [...new Set([...known.keys(), ...gateways])];
      // Reuse existing gateway/name/date index. Bound concurrency and share the
      // result across clients instead of sorting the complete telemetry history.
      const names = [...new Set(['STATE', 'ALARM', ...Object.values(SIGNALS).map(spec => spec[0])])];
      const jobs = all.flatMap(gateway => names.map(name => ({ gateway, name })));
      const rows = [];
      let next = 0;
      await Promise.all(Array.from({length: 8}, async () => {
        while (next < jobs.length) {
          const match = jobs[next++];
          const doc = await col.find(match).sort({ date: -1 }).limit(1).maxTimeMS(4000).next();
          if (doc) rows.push({ doc });
        }
      }));
      const grouped = new Map();
      for (const { doc } of rows) {
        if (!grouped.has(doc.gateway)) grouped.set(doc.gateway, []);
        grouped.get(doc.gateway).push(doc);
      }
      const now = Date.now();
      snapshot = { generatedAt: new Date(now).toISOString(), staleAfterSeconds: staleMs / 1000,
        equipment: all.map(gateway => normalizeEquipment(known.get(gateway) || {
          id: gateway, gateway, name: gateway, model: 'Sin catalogar', test: false
        }, grouped.get(gateway) || [], now, staleMs)) };
      cachedAt = now;
      return snapshot;
    })().finally(() => { pending = null; });
    return pending;
  }
  app.get('/api/fleet', async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await readFleet()); }
    catch { res.status(503).json({ error: 'No se pudo consultar la base de datos. No se muestran datos simulados.' }); }
  });
}
module.exports = { registerFleetRoutes };
