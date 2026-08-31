const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { execFile } = require('child_process');

const MONGO_USER = 'root';
const MONGO_PASS = '@MTK_IOT2026';
const MONGO_HOST = '161.132.68.179';
const MONGO_PORT = 27017;
const MONGO_DB = 'MTKDATA';
const COLLECTION = 'iotdatas';
const PORT = process.env.PORT || 4001;
const POLL_MS = 2000;

const uri = `mongodb://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

let db;
let cachedGateways = [];
let cachedNames = [];

async function refreshCaches() {
  const col = db.collection(COLLECTION);
  cachedGateways = (await col.distinct('gateway')).sort();
  cachedNames = (await col.distinct('name')).sort();
}

app.get('/api/gateways', (req, res) => {
  res.json({ gateways: cachedGateways });
});

app.get('/api/first-data-date', async (req, res) => {
  const gateway = req.query.gateway;
  if (!gateway) {
    res.status(400).json({ error: 'missing gateway' });
    return;
  }
  try {
    const col = db.collection(COLLECTION);
    const arr = await col.find({ gateway }, { projection: { date: 1, _id: 0 } }).sort({ date: 1 }).limit(1).toArray();
    res.json({ firstDate: arr.length ? arr[0].date : null });
  } catch (err) {
    console.error('first-data-date error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.get('/events', async (req, res) => {
  const gateway = req.query.gateway;
  if (!gateway) {
    res.status(400).end('missing gateway');
    return;
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const col = db.collection(COLLECTION);
  let lastDate = new Date(0);

  // Initial snapshot: latest doc per name for this gateway (uses gateway+name+date index)
  try {
    const snapshots = await Promise.all(
      cachedNames.map((name) =>
        col.find({ gateway, name }).sort({ date: -1 }).limit(1).toArray()
      )
    );
    for (const arr of snapshots) {
      if (arr.length) {
        const doc = arr[0];
        const d = new Date(doc.date);
        if (d > lastDate) lastDate = d;
        sendEvent(res, doc, true);
      }
    }
    // let the client know the initial snapshot is done and what the true latest data date is
    res.write(`event: snapshot_done\ndata: ${JSON.stringify({ lastDate: lastDate.toISOString() })}\n\n`);
  } catch (err) {
    console.error('snapshot error:', err.message);
  }

  const interval = setInterval(async () => {
    try {
      const cursor = col
        .find({ gateway, date: { $gt: lastDate } })
        .sort({ date: 1 })
        .limit(500);
      const docs = await cursor.toArray();
      for (const doc of docs) {
        const d = new Date(doc.date);
        if (d > lastDate) lastDate = d;
        sendEvent(res, doc, false);
      }
    } catch (err) {
      console.error('poll error:', err.message);
    }
  }, POLL_MS);

  req.on('close', () => {
    clearInterval(interval);
  });
});

const MAP_NAMES = ['LOCATION', 'STATE'];

app.get('/events/locations', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const col = db.collection(COLLECTION);
  let lastDate = new Date(0);

  // Initial snapshot: latest LOCATION and latest STATE doc per gateway
  try {
    const snapshots = await Promise.all(
      cachedGateways.flatMap((gateway) =>
        MAP_NAMES.map((name) =>
          col.find({ gateway, name }).sort({ date: -1 }).limit(1).toArray()
        )
      )
    );
    for (const arr of snapshots) {
      if (arr.length) {
        const doc = arr[0];
        const d = new Date(doc.date);
        if (d > lastDate) lastDate = d;
        sendEvent(res, doc, true);
      }
    }
    res.write(`event: snapshot_done\ndata: ${JSON.stringify({ lastDate: lastDate.toISOString() })}\n\n`);
  } catch (err) {
    console.error('locations snapshot error:', err.message);
  }

  const interval = setInterval(async () => {
    try {
      const docs = await col
        .find({ name: { $in: MAP_NAMES }, date: { $gt: lastDate } })
        .sort({ date: 1 })
        .limit(500)
        .toArray();
      for (const doc of docs) {
        const d = new Date(doc.date);
        if (d > lastDate) lastDate = d;
        sendEvent(res, doc, false);
      }
    } catch (err) {
      console.error('locations poll error:', err.message);
    }
  }, POLL_MS);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Chequeo de conectividad de red (ping ICMP), independiente de si llegan datos a Mongo.
const GATEWAY_IPS = {
  'A16Q2M': '172.25.158.38',  // D8T-1
  'A16Q21': '172.25.164.103', // D8T-2
  'A16Q25': '172.25.169.133', // D8T-3
  'A16M5P': '172.25.179.250', // D8T-4
  'A16Q2C': '172.25.15.241',  // D8T-5
  'A16Q2L': '172.25.197.205', // D8T-6
  'A16Q28': '172.25.30.106',  // D8-1
  'A16Q2G': '172.25.169.180', // D8-2
  'A16Q23': '172.25.90.20',   // D9-1
  'A16Q2J': '172.25.7.182',   // D9-2
  'A16Q24': '172.25.156.127', // D9-3
  'A16Q26': '172.25.67.10',   // D9-4
  'A16Q27': '172.25.212.69',  // D9-5
  'A16Q2D': '172.25.116.188', // D9T-1
  'A16M6H': '172.25.35.40',   // D9T-2
  'A16Q22': '172.25.66.243'   // D9T-3
};

const PING_INTERVAL_MS = 20000;
const PING_TIMEOUT_MS = 1500;

let pingStatus = {}; // gateway -> { ip, ok, checkedAt }

function pingHost(ip) {
  return new Promise((resolve) => {
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', String(PING_TIMEOUT_MS), ip]
      : ['-c', '1', '-W', String(Math.ceil(PING_TIMEOUT_MS / 1000)), ip];
    execFile('ping', args, { timeout: PING_TIMEOUT_MS + 1000 }, (err) => {
      resolve(!err);
    });
  });
}

async function refreshPingStatus() {
  await Promise.all(
    Object.entries(GATEWAY_IPS).map(async ([gateway, ip]) => {
      const ok = await pingHost(ip);
      pingStatus[gateway] = { ip, ok, checkedAt: new Date().toISOString() };
    })
  );
}

app.get('/api/ping-status', (req, res) => {
  res.json({ pingStatus });
});

function cleanDoc(doc) {
  const payload = Object.assign({}, doc);
  delete payload._id;
  delete payload.__v;
  return payload;
}

function sendEvent(res, doc, isSnapshot) {
  const payload = cleanDoc(doc);
  payload._snapshot = !!isSnapshot;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ---------- Historial (instante + rango) ----------

async function latestDocAtOrBefore(gateway, name, atDate) {
  const col = db.collection(COLLECTION);
  const arr = await col.find({ gateway, name, date: { $lte: atDate } }).sort({ date: -1 }).limit(1).toArray();
  return arr.length ? arr[0] : null;
}

app.get('/api/history/instant', async (req, res) => {
  const gateway = req.query.gateway;
  const at = new Date(req.query.at);
  if (!gateway || isNaN(at.getTime())) {
    res.status(400).json({ error: 'missing or invalid gateway/at' });
    return;
  }
  try {
    const docs = await Promise.all(cachedNames.map((name) => latestDocAtOrBefore(gateway, name, at)));
    res.json({ docs: docs.filter(Boolean).map(cleanDoc) });
  } catch (err) {
    console.error('history instant error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Mismas 11 series que ya se grafican en vivo en el Panel Pro (public/index.html, updateProView)
const HISTORY_SERIES = {
  rpm: { docName: 'EEC1', field: 'RPM_MOTOR' },
  coolant: { docName: 'ET1', field: 'ENG_COOLANT_TEMP' },
  fuel: { docName: 'DD', field: 'FUEL_LEVEL' },
  voltage: { docName: 'VEP1', field: 'VOLTAJE_BATERIA' },
  hydtemp: { docName: 'VF', field: 'VF_HYD_TEMP' },
  load: { docName: 'CALC', field: 'ENGINE_LOAD' },
  hours: { docName: 'HOURS', field: 'ENG_TOTAL_HOURS' },
  fuelrate: { docName: 'LFE1', field: 'ENGINE_FUEL_RATE' },
  boost: { docName: 'IC1', field: 'ENG_TURBO_BOOST_PRESS' },
  ambient: { docName: 'AMB', field: 'AMBIENT_AIR_TEMP' },
  speed: { docName: 'LOCATION', field: 'speed' }
};

const RAW_POINTS_LIMIT = 3000;

function bucketMsForRange(rangeMs) {
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  if (rangeMs <= 3 * HOUR) return 0; // sin bucket, puntos crudos
  if (rangeMs <= 2 * DAY) return 5 * 60 * 1000;
  if (rangeMs <= 14 * DAY) return HOUR;
  if (rangeMs <= 60 * DAY) return 6 * HOUR;
  return DAY;
}

async function fetchSeries(gateway, docName, field, from, to, bucketMs) {
  const col = db.collection(COLLECTION);
  const match = { gateway, name: docName, date: { $gte: from, $lte: to } };

  if (bucketMs === 0) {
    const docs = await col
      .find(match, { projection: { date: 1, [field]: 1, _id: 0 } })
      .sort({ date: 1 })
      .limit(RAW_POINTS_LIMIT)
      .toArray();
    return docs
      .map((d) => ({ t: new Date(d.date).toISOString(), v: parseFloat(d[field]) }))
      .filter((p) => !isNaN(p.v));
  }

  const pipeline = [
    { $match: match },
    { $addFields: { _ms: { $toLong: '$date' } } },
    { $addFields: { _bucketMs: { $subtract: ['$_ms', { $mod: ['$_ms', bucketMs] }] } } },
    {
      $group: {
        _id: '$_bucketMs',
        avgVal: { $avg: { $convert: { input: `$${field}`, to: 'double', onError: null, onNull: null } } }
      }
    },
    { $sort: { _id: 1 } }
  ];
  const rows = await col.aggregate(pipeline).toArray();
  return rows
    .filter((r) => r.avgVal !== null && r.avgVal !== undefined)
    .map((r) => ({ t: new Date(r._id).toISOString(), v: r.avgVal }));
}

// STATE es categorico (Off/KeyOn/Idle/Duty): no se promedia, se toma el ultimo
// valor real de cada bucket para poder identificar cuando el equipo estuvo apagado.
async function fetchStateSeries(gateway, from, to, bucketMs) {
  const col = db.collection(COLLECTION);
  const match = { gateway, name: 'STATE', date: { $gte: from, $lte: to } };

  if (bucketMs === 0) {
    const docs = await col
      .find(match, { projection: { date: 1, STATE: 1, _id: 0 } })
      .sort({ date: 1 })
      .limit(RAW_POINTS_LIMIT)
      .toArray();
    return docs.map((d) => ({ t: new Date(d.date).toISOString(), state: d.STATE }));
  }

  const pipeline = [
    { $match: match },
    { $sort: { date: 1 } },
    { $addFields: { _ms: { $toLong: '$date' } } },
    { $addFields: { _bucketMs: { $subtract: ['$_ms', { $mod: ['$_ms', bucketMs] }] } } },
    { $group: { _id: '$_bucketMs', state: { $last: '$STATE' } } },
    { $sort: { _id: 1 } }
  ];
  const rows = await col.aggregate(pipeline).toArray();
  return rows.map((r) => ({ t: new Date(r._id).toISOString(), state: r.state }));
}

// Traza del recorrido GPS: igual que fetchStateSeries (usa $last por bucket, no
// promedio), porque promediar lat/lon daria puntos que no corresponden a un
// lugar real por donde paso el equipo.
async function fetchTrackSeries(gateway, from, to, bucketMs) {
  const col = db.collection(COLLECTION);
  const match = { gateway, name: 'LOCATION', date: { $gte: from, $lte: to } };

  if (bucketMs === 0) {
    const docs = await col
      .find(match, { projection: { date: 1, latitude: 1, longitude: 1, speed: 1, _id: 0 } })
      .sort({ date: 1 })
      .limit(RAW_POINTS_LIMIT)
      .toArray();
    return docs
      .map((d) => ({ t: new Date(d.date).toISOString(), lat: parseFloat(d.latitude), lon: parseFloat(d.longitude), speed: parseFloat(d.speed) }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
  }

  const pipeline = [
    { $match: match },
    { $sort: { date: 1 } },
    { $addFields: { _ms: { $toLong: '$date' } } },
    { $addFields: { _bucketMs: { $subtract: ['$_ms', { $mod: ['$_ms', bucketMs] }] } } },
    { $group: { _id: '$_bucketMs', lat: { $last: '$latitude' }, lon: { $last: '$longitude' }, speed: { $last: '$speed' } } },
    { $sort: { _id: 1 } }
  ];
  const rows = await col.aggregate(pipeline).toArray();
  return rows
    .map((r) => ({ t: new Date(r._id).toISOString(), lat: parseFloat(r.lat), lon: parseFloat(r.lon), speed: parseFloat(r.speed) }))
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

app.get('/api/history/track', async (req, res) => {
  const gateway = req.query.gateway;
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (!gateway || isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
    res.status(400).json({ error: 'missing or invalid gateway/from/to' });
    return;
  }
  try {
    const bucketMs = bucketMsForRange(to.getTime() - from.getTime());
    const points = await fetchTrackSeries(gateway, from, to, bucketMs);
    res.json({ points, bucketMs });
  } catch (err) {
    console.error('history track error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.get('/api/history/range', async (req, res) => {
  const gateway = req.query.gateway;
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (!gateway || isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
    res.status(400).json({ error: 'missing or invalid gateway/from/to' });
    return;
  }
  const requestedKeys = req.query.series
    ? String(req.query.series).split(',').map((s) => s.trim()).filter((k) => HISTORY_SERIES[k])
    : Object.keys(HISTORY_SERIES);

  const bucketMs = bucketMsForRange(to.getTime() - from.getTime());

  try {
    const result = {};
    const [, stateResult] = await Promise.all([
      Promise.all(
        requestedKeys.map(async (key) => {
          const { docName, field } = HISTORY_SERIES[key];
          const [seed, points] = await Promise.all([
            latestDocAtOrBefore(gateway, docName, from),
            fetchSeries(gateway, docName, field, from, to, bucketMs)
          ]);
          const series = points.slice();
          if (seed) {
            const seedVal = parseFloat(seed[field]);
            const firstPointMs = series.length ? new Date(series[0].t).getTime() : Infinity;
            if (!isNaN(seedVal) && new Date(seed.date).getTime() < firstPointMs) {
              series.unshift({ t: from.toISOString(), v: seedVal });
            }
          }
          result[key] = series;
        })
      ),
      (async () => {
        const [seed, points] = await Promise.all([
          latestDocAtOrBefore(gateway, 'STATE', from),
          fetchStateSeries(gateway, from, to, bucketMs)
        ]);
        const state = points.slice();
        const firstPointMs = state.length ? new Date(state[0].t).getTime() : Infinity;
        if (seed && seed.STATE !== undefined && new Date(seed.date).getTime() < firstPointMs) {
          state.unshift({ t: from.toISOString(), state: seed.STATE });
        }
        return state;
      })()
    ]);
    res.json({ series: result, state: stateResult, bucketMs });
  } catch (err) {
    console.error('history range error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});
// ---------- fin Historial ----------

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db(MONGO_DB);
  await refreshCaches();
  setInterval(() => {
    refreshCaches().catch((err) => console.error('refreshCaches error:', err.message));
  }, 5 * 60 * 1000);

  const server = app.listen(PORT, () => {
    console.log(`Dashboard corriendo en http://localhost:${PORT}`);
    console.log(`Gateways detectados: ${cachedGateways.join(', ')}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err.message);
  });

  refreshPingStatus().catch((err) => console.error('ping status error:', err.message));
  setInterval(() => {
    refreshPingStatus().catch((err) => console.error('ping status error:', err.message));
  }, PING_INTERVAL_MS);
}

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err.stack || err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && err.stack || err);
});

main().catch((err) => {
  console.error('No se pudo conectar a MongoDB:', err.message);
  process.exit(1);
});
