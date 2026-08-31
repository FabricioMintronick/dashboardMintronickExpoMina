'use strict';
const { SIGNALS, numeric } = require('../domain/telemetry');
const LIMIT = 5000;
function validateQuery(query) {
  const { gateway, signal, from, to } = query;
  if (typeof gateway !== 'string' || !gateway || gateway.length > 80 || !Object.hasOwn(SIGNALS, signal || '')) return null;
  const start = new Date(from), end = new Date(to);
  const range = end - start;
  if (!Number.isFinite(range) || range <= 0 || range > 31 * 86400000) return null;
  return { gateway, signal, start, end, range };
}
function registerHistoryRoutes(app, { getDb, collection, staleMs }) {
  app.get('/api/telemetry/history', async (req, res) => {
    const input = validateQuery(req.query);
    if (!input) return res.status(400).json({ error: 'Selecciona un equipo, una señal y un rango válido de hasta 31 días.' });
    if (!getDb()) return res.status(503).json({ error: 'Base de datos no disponible' });
    const { gateway, signal, start, end, range } = input;
    const [name, field, label, unit] = SIGNALS[signal];
    const match = { gateway, name, date: { $gte: start, $lte: end } };
    const bucketMs = range <= 86400000 ? 0 : range <= 7 * 86400000 ? 300000 : 1800000;
    try {
      const col = getDb().collection(collection);
      let points;
      if (!bucketMs) {
        const docs = await col.find(match, { projection: { date: 1, [field]: 1, _id: 0 } })
          .sort({ date: 1 }).limit(LIMIT + 1).maxTimeMS(10000).toArray();
        points = docs.map(d => ({ t: d.date, v: numeric(d[field]) }));
      } else {
        const rows = await col.aggregate([
          { $match: match },
          { $project: { date: 1, value: { $convert: { input: `$${field}`, to: 'double', onError: null, onNull: null } } } },
          { $group: { _id: { $subtract: [{ $toLong: '$date' }, { $mod: [{ $toLong: '$date' }, bucketMs] }] },
            v: { $avg: '$value' }, min: { $min: '$value' }, max: { $max: '$value' }, count: { $sum: { $cond: [{ $ne: ['$value', null] }, 1, 0] } } } },
          { $sort: { _id: 1 } }, { $limit: LIMIT + 1 }
        ], { maxTimeMS: 10000 }).toArray();
        points = rows.map(r => ({ t: new Date(r._id), v: r.v, min: r.min, max: r.max, count: r.count }));
      }
      const truncated = points.length > LIMIT;
      res.set('Cache-Control', 'no-store').json({ signal, label, unit, from: start, to: end,
        bucketMs, gapAfterMs: bucketMs || staleMs, truncated, points: points.slice(0, LIMIT),
        note: bucketMs ? 'Promedios por intervalo con mínimos y máximos. No permiten determinar duración exacta de eventos ni cobertura interna.' : 'Lecturas originales. Sin interpolación sobre huecos ni valores anteriores al rango.' });
    } catch { res.status(503).json({ error: 'No se pudo obtener el historial. Prueba un periodo más corto.' }); }
  });
}
module.exports = { registerHistoryRoutes, validateQuery };
