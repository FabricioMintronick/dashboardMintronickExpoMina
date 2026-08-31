'use strict';

const SIGNALS = {
  rpm: ['EEC1', 'RPM_MOTOR', 'RPM del motor', 'rpm'],
  coolant: ['ET1', 'ENG_COOLANT_TEMP', 'Temperatura de refrigerante', '°C'],
  fuel: ['DD', 'FUEL_LEVEL', 'Nivel de combustible', '%'],
  voltage: ['VEP1', 'VOLTAJE_BATERIA', 'Voltaje de batería', 'V'],
  hydtemp: ['VF', 'VF_HYD_TEMP', 'Temperatura hidráulica', '°C'],
  load: ['CALC', 'ENGINE_LOAD', 'Carga del motor', '%'],
  hours: ['HOURS', 'ENG_TOTAL_HOURS', 'Horómetro', 'h'],
  fuelrate: ['LFE1', 'ENGINE_FUEL_RATE', 'Consumo instantáneo', 'L/h'],
  speed: ['LOCATION', 'speed', 'Velocidad GPS', 'km/h'],
  fuelTotal: ['LFC1', 'ENG_TOTAL_FUEL_USED', 'Combustible acumulado', 'L'],
  idleHours: ['IO', 'ENG_TOTAL_IDLE_HOURS', 'Horas acumuladas en ralentí', 'h'],
  idleFuel: ['IO', 'ENG_TOTAL_IDLE_FUEL_USED', 'Combustible acumulado en ralentí', 'L']
};
const ALARMS = {
  OVERHEATING: 'Sobrecalentamiento', HYD_OVERHEATING: 'Temperatura hidráulica',
  TC_OVERHEATING: 'Temperatura del convertidor', LOW_FUEL: 'Combustible bajo',
  LOW_BATTERY: 'Batería baja', HIGH_BATTERY: 'Batería alta', AIR_FILTER_CLOGGED: 'Filtro de aire',
  OVERSPEED: 'Sobrevelocidad', HIGH_LOAD_LOW_RPM: 'Carga alta / RPM bajo',
  LOW_BOOST: 'Presión turbo baja', HARSH_EVENT: 'Evento brusco', EXCESSIVE_IDLE: 'Ralentí excesivo'
};
function numeric(value) {
  if (!['number','string'].includes(typeof value) || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function freshness(date, now, staleMs) {
  const time = date == null ? NaN : new Date(date).getTime();
  if (!Number.isFinite(time)) return 'missing';
  if (time > now + 60000) return 'invalid';
  return now - time > staleMs ? 'stale' : 'fresh';
}
function flag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}
function normalizeEquipment(equipment, docs, now = Date.now(), staleMs = 120000) {
  const byName = Object.fromEntries(docs.map(doc => [doc.name, doc]));
  const metrics = Object.fromEntries(Object.entries(SIGNALS).map(([key, [name, field, label, unit]]) => {
    const doc = byName[name];
    const value = numeric(doc?.[field]);
    return [key, { label, unit, value, at: doc?.date || null,
      quality: value === null ? 'missing' : freshness(doc?.date, now, staleMs) }];
  }));
  const state = byName.STATE;
  const location = byName.LOCATION;
  const lat = numeric(location?.latitude), lon = numeric(location?.longitude);
  const validLocation = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  const alarm = byName.ALARM;
  const alarmQuality = freshness(alarm?.date, now, staleMs);
  const activeAlarms = Object.entries(ALARMS).filter(([field]) => flag(alarm?.[field]) === true)
    .map(([code, label]) => ({ code, label, at: alarm.date, quality: alarmQuality }));
  const completeAlarmSnapshot = Object.keys(ALARMS).every(key => flag(alarm?.[key]) !== null);
  const dates = docs.map(doc => new Date(doc.date).getTime()).filter(time => Number.isFinite(time) && time <= now + 60000);
  const lastAt = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
  return { ...equipment, lastAt, communication: freshness(lastAt, now, staleMs),
    state: { value: state?.STATE || null, at: state?.date || null, quality: freshness(state?.date, now, staleMs) },
    metrics, location: validLocation ? { lat, lon, at: location.date, quality: freshness(location.date, now, staleMs) } : null,
    alarms: activeAlarms, alarmQuality, alarmStates: Object.fromEntries(Object.keys(ALARMS).map(key=>[key,flag(alarm?.[key])])),
    condition: activeAlarms.length ? (alarmQuality === 'fresh' ? 'reported' : 'last-alert') :
      (completeAlarmSnapshot && alarmQuality === 'fresh' ? 'no-reported-alerts' : 'unknown') };
}
module.exports = { SIGNALS, ALARMS, numeric, freshness, flag, normalizeEquipment };
