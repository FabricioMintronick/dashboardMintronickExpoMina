'use strict';
const { SIGNALS, numeric } = require('../domain/telemetry');
const LIMIT = 5000;
const TARGET_BUCKETS = 1200;
function automaticBucket(range) {
  const minute = 60000;
  return Math.max(minute, Math.ceil(range / TARGET_BUCKETS / minute) * minute);
}
async function aggregate(col, match, field, bucketMs) {
  const rows = await col.aggregate([
    { $match: match },
    { $project: { date: 1, value: { $convert: { input: `$${field}`, to: 'double', onError: null, onNull: null } } } },
    { $group: { _id: { $subtract: [{ $toLong: '$date' }, { $mod: [{ $toLong: '$date' }, bucketMs] }] },
      v: { $avg: '$value' }, min: { $min: '$value' }, max: { $max: '$value' }, count: { $sum: { $cond: [{ $ne: ['$value', null] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ], { maxTimeMS: 45000, hint: { gateway: 1, name: 1, date: -1 } }).toArray();
  return rows.map(r => ({ t: new Date(r._id), v: r.v, min: r.min, max: r.max, count: r.count }));
}
function validateQuery(query) {
  const { gateway, signal, from, to } = query;
  if(query.resolution!==undefined && query.resolution!=='aggregate')return null;
  if (typeof gateway !== 'string' || !gateway || gateway.length > 80 || !Object.hasOwn(SIGNALS, signal || '')) return null;
  const start = new Date(from), end = new Date(to);
  const range = end - start;
  if (!Number.isFinite(range) || range <= 0 || range > 183 * 86400000) return null;
  return { gateway, signal, start, end, range };
}
function registerHistoryRoutes(app, { getDb, collection, staleMs }) {
  app.get('/api/telemetry/history', async (req, res) => {
    const input = validateQuery(req.query);
    if (!input) return res.status(400).json({ error: 'Selecciona un equipo, una señal y un rango válido de hasta 6 meses.' });
    if (!getDb()) return res.status(503).json({ error: 'Base de datos no disponible' });
    const { gateway, signal, start, end, range } = input;
    const [name, field, label, unit] = SIGNALS[signal];
    const match = { gateway, name, date: { $gte: start, $lte: end } };
    let bucketMs = range <= 86400000 ? (req.query.resolution==='aggregate'?automaticBucket(range):0)
      : range <= 7 * 86400000 ? 300000
      : range <= 31 * 86400000 ? 1800000
      : range <= 93 * 86400000 ? 7200000 : 21600000;
    try {
      const col = getDb().collection(collection);
      let points, automaticallySummarized = false;
      if (!bucketMs) {
        const docs = await col.find(match, { projection: { date: 1, [field]: 1, _id: 0 } })
          .sort({ date: 1 }).limit(LIMIT + 1).maxTimeMS(10000).toArray();
        if (docs.length > LIMIT) {
          bucketMs = automaticBucket(range);
          points = await aggregate(col, match, field, bucketMs);
          automaticallySummarized = true;
        } else points = docs.map(d => ({ t: d.date, v: numeric(d[field]) }));
      } else {
        points = await aggregate(col, match, field, bucketMs);
      }
      const truncated = points.length > LIMIT;
      res.set('Cache-Control', 'no-store').json({ signal, label, unit, from: start, to: end,
        bucketMs, gapAfterMs: bucketMs || staleMs, truncated, automaticallySummarized, points: points.slice(0, LIMIT),
        note: bucketMs ? `${automaticallySummarized?'El volumen superó 5 000 lecturas; ':''}todo el periodo fue resumido por intervalos con promedio, mínimo, máximo y cantidad de muestras. Los huecos no se interpolan.` : 'Lecturas originales. Sin interpolación sobre huecos ni valores anteriores al rango.' });
    } catch { res.status(503).json({ error: 'No se pudo obtener el historial. Prueba un periodo más corto.' }); }
  });
}
module.exports = { registerHistoryRoutes, validateQuery, automaticBucket };
