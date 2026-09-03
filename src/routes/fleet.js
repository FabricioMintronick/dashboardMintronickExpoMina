'use strict';
const { normalizeEquipment, SIGNALS } = require('../domain/telemetry');
const {offsetLocation}=require('../domain/location-privacy');

function registerFleetRoutes(app, { getDb, getGateways, collection, catalog, staleMs, gpsPrivacyEnabled=false, gpsLatOffset=0, gpsLonOffset=0 }) {
  let snapshot = null, cachedAt = 0, pending = null;
  const stateSince=new Map(),stateValues=new Map();
  async function readFleet() {
    if (snapshot && Date.now() - cachedAt < 2000) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      const db = getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const col = db.collection(collection);
      const known = new Map(catalog.map(item => [item.gateway, item]));
      // equipment.json is the allow-list shown by the product. Database
      // gateways outside the catalog must never appear as accidental assets.
      const all = [...known.keys()];
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
      await Promise.all(all.map(async gateway=>{
        const latestDoc=(grouped.get(gateway)||[]).find(doc=>doc.name==='STATE');
        const latestValue=String(latestDoc?.STATE??'').toLowerCase();
        if(stateValues.get(gateway)===latestValue&&stateSince.has(gateway))return;
        if(!latestDoc)return;
        const previous=await col.find({gateway,name:'STATE',STATE:{$ne:latestDoc.STATE}},{projection:{date:1,_id:0}}).sort({date:-1}).limit(1).maxTimeMS(4000).next();
        const first=await col.find({gateway,name:'STATE',STATE:latestDoc.STATE,...(previous?{date:{$gt:previous.date}}:{})},{projection:{date:1,_id:0}}).sort({date:1}).limit(1).maxTimeMS(4000).next();
        stateSince.set(gateway,first?.date||latestDoc.date);stateValues.set(gateway,latestValue);
      }));
      const now = Date.now();
      snapshot = { generatedAt: new Date(now).toISOString(), staleAfterSeconds: staleMs / 1000,
        equipment: all.map(gateway => {const item=normalizeEquipment(known.get(gateway) || {
          id: gateway, gateway, name: gateway, model: 'Sin catalogar', test: false
        }, grouped.get(gateway) || [], now, staleMs);return {...item,state:{...item.state,since:stateSince.get(gateway)||item.state.at},location:offsetLocation(item.location,gateway,gpsPrivacyEnabled,gpsLatOffset,gpsLonOffset)};}) };
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
