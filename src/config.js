'use strict';
const path = require('node:path');
const fs = require('node:fs');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] = value.startsWith('"') ? JSON.parse(value) : value;
  }
}
const PORT = Number(process.env.PORT || 4001);
const seconds = Number(process.env.STALE_AFTER_SECONDS || 120);
const ALLOW_LAN = process.env.ALLOW_LAN === 'true';
// Opción reversible de privacidad cartográfica. Usa false para coordenadas reales.
const GPS_PRIVACY_ENABLED = process.env.GPS_PRIVACY_ENABLED !== 'false';
const GPS_LAT_OFFSET=Number(process.env.GPS_LAT_OFFSET||.75);
const GPS_LON_OFFSET=Number(process.env.GPS_LON_OFFSET||.75);
let DASHBOARD_USERS={};
if(process.env.DASHBOARD_USERS_JSON){try{DASHBOARD_USERS=JSON.parse(process.env.DASHBOARD_USERS_JSON);}catch{throw new Error('DASHBOARD_USERS_JSON no contiene JSON válido');}}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Puerto inválido');
if (!Number.isFinite(seconds) || seconds < 1) throw new Error('Vigencia inválida');
module.exports = { uri: process.env.MONGO_URI || '', MONGO_DB: process.env.MONGO_DB || 'MTKDATA',
  COLLECTION: process.env.MONGO_COLLECTION || 'iotdatas', PORT, STALE_MS: seconds * 1000, ALLOW_LAN, GPS_PRIVACY_ENABLED, GPS_LAT_OFFSET, GPS_LON_OFFSET,
  DASHBOARD_USER:process.env.DASHBOARD_USER||'',DASHBOARD_PASSWORD:process.env.DASHBOARD_PASSWORD||'',DASHBOARD_USERS,AUTH_SECRET:process.env.AUTH_SECRET||'',AUTH_COOKIE_SECURE:process.env.AUTH_COOKIE_SECURE!=='false' };
