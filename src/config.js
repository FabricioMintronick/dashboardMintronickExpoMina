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
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Puerto inválido');
if (!Number.isFinite(seconds) || seconds < 1) throw new Error('Vigencia inválida');
module.exports = { uri: process.env.MONGO_URI || '', MONGO_DB: process.env.MONGO_DB || 'MTKDATA',
  COLLECTION: process.env.MONGO_COLLECTION || 'iotdatas', PORT, STALE_MS: seconds * 1000 };
