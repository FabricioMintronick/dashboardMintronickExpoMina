
const grid = document.getElementById('grid');
const gatewaySelect = document.getElementById('gatewaySelect');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');

let cards = {};
let evtSource = null;
let currentStreamedGateway = null;

const GATEWAY_NAMES = {
  'A16Q2M': 'D8T-1',
  'A16Q21': 'D8T-2',
  'A16Q25': 'D8T-3',
  'A16M5P': 'D8T-4',
  'A16Q2C': 'D8T-5',
  'A16Q2L': 'D8T-6',
  'A16Q28': 'D8-1',
  'A16Q2G': 'D8-2',
  'A16Q23': 'D9-1',
  'A16Q2J': 'D9-2',
  'A16Q24': 'D9-3',
  'A16Q26': 'D9-4',
  'A16Q27': 'D9-5',
  'A16Q2D': 'D9T-1',
  'A16M6H': 'D9T-2',
  'A16Q22': 'D9T-3',
  'A16M6M': 'TEST'
};

function gatewayLabel(code) {
  const name = GATEWAY_NAMES[code];
  return name ? `${name} (${code})` : code;
}

function setStatus(on, text) {
  dot.className = 'dot ' + (on ? 'on' : 'off');
  statusText.textContent = text;
}

const STATE_COLORS = {
  off: '#70818a',
  idle: '#f1c40f',
  keyon: '#e67e22',
  duty: '#2ecc71'
};

function stateColor(value) {
  return STATE_COLORS[String(value || '').toLowerCase()] || '#999';
}

// ---------- Panel Pro: gauges, medidores, indicadores y alarmas ----------
// Umbrales de zona (bueno/alerta/critico) son valores genericos de referencia
// para motores diesel de esta clase; ajustar si se cuenta con specs reales del D8.
const STATUS_HEX = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b', muted: '#898781' };
const STATUS_TEXT = { good: '#ffffff', warning: '#1a1a1a', critical: '#ffffff', muted: '#ffffff' };
const STATUS_LABEL = { good: 'Referencia', warning: 'Revisar referencia', critical: 'Revisar referencia', muted: '--' };

const GAUGE_SPECS = [
  {
    key: 'rpm', label: 'RPM Motor', unit: 'rpm', min: 0, max: 2500,
    zones: [{ limit: 2000, status: 'good' }, { limit: 2300, status: 'warning' }, { limit: Infinity, status: 'critical' }]
  },
  {
    key: 'coolant', label: 'Temp. Refrigerante', unit: 'C', min: 0, max: 120,
    zones: [{ limit: 95, status: 'good' }, { limit: 105, status: 'warning' }, { limit: Infinity, status: 'critical' }]
  },
  {
    key: 'fuel', label: 'Nivel Combustible', unit: '%', min: 0, max: 100,
    zones: [{ limit: 15, status: 'critical' }, { limit: 30, status: 'warning' }, { limit: Infinity, status: 'good' }]
  },
  {
    key: 'voltage', label: 'Voltaje Bateria', unit: 'V', min: 18, max: 32,
    zones: [
      { limit: 22, status: 'critical' },
      { limit: 24, status: 'warning' },
      { limit: 29, status: 'good' },
      { limit: 30, status: 'warning' },
      { limit: Infinity, status: 'critical' }
    ]
  },
  {
    key: 'hydtemp', label: 'Temp. Hidraulica', unit: 'C', min: 0, max: 100,
    zones: [{ limit: 70, status: 'good' }, { limit: 85, status: 'warning' }, { limit: Infinity, status: 'critical' }]
  }
];

const METER_SPECS = [
  { key: 'load', label: 'Carga Motor', unit: '%', min: 0, max: 100 }
];

const STAT_SPECS = [
  { key: 'hours', label: 'Horometro', unit: 'h' },
  { key: 'fuelrate', label: 'Consumo Combustible', unit: 'L/h' },
  { key: 'boost', label: 'Presion Turbo', unit: 'kPa' },
  { key: 'ambient', label: 'Temp. Ambiente', unit: 'C' },
  { key: 'speed', label: 'Velocidad', unit: 'km/h' }
];

// Datos adicionales: cada tile aparece solo si ese equipo realmente reporta el campo
// (distintos equipos/gateways no siempre envian los mismos tipos de documento).
// keepLastValue: true = igual que voltaje/combustible, no se fuerza a 0 al apagar
// (acumulados, altitud y rumbo son datos que no "desaparecen" al apagar el motor).
const EXTRA_FIELD_SPECS = [
  { docName: 'ETC2', field: 'TRANS_CURRENT_GEAR', label: 'Marcha Actual', format: 'text' },
  { docName: 'CALC', field: 'DIRECTION', label: 'Direccion', format: 'text' },
  { docName: 'EEC3', field: 'ENG_DESIRED_SPEED', label: 'RPM Deseado', unit: 'rpm' },
  { docName: 'EEC1', field: 'ENG_PERCENT_TORQUE', label: 'Torque Motor', unit: '%' },
  { docName: 'ET1', field: 'ENG_FUEL_TEMP1', label: 'Temp. Combustible', unit: 'C' },
  { docName: 'IC1', field: 'ENG_INTAKE_MANIFOLD1_TEMP', label: 'Temp. Multiple Admision', unit: 'C' },
  { docName: 'IC1', field: 'ENG_AIR_INLET_PRESS', label: 'Presion Admision Aire', unit: 'kPa' },
  { docName: 'IC1', field: 'ENG_AIR_FILTER1_DIFF_PRESS', label: 'Diferencial Filtro Aire', unit: 'kPa' },
  { docName: 'IMT1', field: 'IMT1_TC1_BOOST_PRESS', label: 'Presion Boost (IMT1)', unit: 'kPa' },
  { docName: 'AMB', field: 'BAROMETRIC_PRESSURE', label: 'Presion Barometrica', unit: 'kPa' },
  { docName: 'AMB', field: 'ENG_AIR_INLET_TEMP', label: 'Temp. Admision Motor', unit: 'C' },
  { docName: 'LFC1', field: 'ENG_TOTAL_FUEL_USED', label: 'Combustible Total Usado', unit: 'L', format: 'int-commas', keepLastValue: true },
  { docName: 'IO', field: 'ENG_TOTAL_IDLE_HOURS', label: 'Horas en Ralenti', unit: 'h', keepLastValue: true },
  { docName: 'IO', field: 'ENG_TOTAL_IDLE_FUEL_USED', label: 'Combustible en Ralenti', unit: 'L', format: 'int-commas', keepLastValue: true },
  { docName: 'HOURS', field: 'ENG_TOTAL_REVOLUTIONS', label: 'Revoluciones Totales', format: 'int-commas', keepLastValue: true },
  { docName: 'LOCATION', field: 'altitude', label: 'Altitud', unit: 'm', keepLastValue: true },
  { docName: 'LOCATION', field: 'course', label: 'Rumbo', unit: '°', keepLastValue: true },
  { docName: 'ACCS', field: 'LATERAL_ACCEL', label: 'Acel. Lateral', unit: 'g' },
  { docName: 'ACCS', field: 'LONG_ACCEL', label: 'Acel. Longitudinal', unit: 'g' },
  { docName: 'ACCS', field: 'VERTICAL_ACCEL', label: 'Acel. Vertical', unit: 'g' },
  { docName: 'ARI', field: 'YAW_RATE', label: 'Yaw Rate', unit: '°/s' }
];

const ALARM_LABELS = {
  OVERHEATING: 'Sobrecalentamiento',
  HYD_OVERHEATING: 'Sobrecalent. hidraulico',
  TC_OVERHEATING: 'Sobrecalent. convertidor',
  LOW_FUEL: 'Combustible bajo',
  LOW_BATTERY: 'Bateria baja',
  HIGH_BATTERY: 'Bateria alta',
  AIR_FILTER_CLOGGED: 'Filtro de aire obstruido',
  OVERSPEED: 'Sobrevelocidad',
  HIGH_LOAD_LOW_RPM: 'Carga alta / RPM bajo',
  LOW_BOOST: 'Presion turbo baja',
  HARSH_EVENT: 'Evento brusco',
  EXCESSIVE_IDLE: 'Ralenti excesivo'
};

const GAUGE_R = 82;
const GAUGE_LEN = Math.PI * GAUGE_R;

function gaugeStatusFor(value, zones) {
  if (value == null || isNaN(value)) return 'muted';
  for (const z of zones) {
    if (value <= z.limit) return z.status;
  }
  return zones[zones.length - 1].status;
}

const proStateChip = document.getElementById('proStateChip');
const proTs = document.getElementById('proTs');
const proGauges = document.getElementById('proGauges');
const proStats = document.getElementById('proStats');
const proExtra = document.getElementById('proExtra');
const proAlarms = document.getElementById('proAlarms');

const gaugeEls = {};
const meterEls = {};
const statEls = {};
const extraTileEls = {}; // "docName.field" -> <span> con el valor

function buildProPanel() {
  GAUGE_SPECS.forEach((spec) => {
    const card = document.createElement('div');
    card.className = 'card gauge-card';
    card.innerHTML = `
      <div class="gauge-label">${spec.label}</div>
      <svg viewBox="0 0 200 108" class="gauge-svg">
        <path class="gauge-track" d="M18 100 A82 82 0 1 1 182 100"/>
        <path class="gauge-value" d="M18 100 A82 82 0 1 1 182 100" stroke-dasharray="0 ${GAUGE_LEN.toFixed(1)}"/>
      </svg>
      <div class="gauge-value-text"><span class="gauge-num">--</span><span class="gauge-unit">${spec.unit}</span></div>
      <div class="gauge-minmax"><span>${spec.min}</span><span>${spec.max}</span></div>
      <span class="gw-state-badge gauge-status">--</span>
    `;
    proGauges.appendChild(card);
    gaugeEls[spec.key] = {
      valuePath: card.querySelector('.gauge-value'),
      num: card.querySelector('.gauge-num'),
      status: card.querySelector('.gauge-status')
    };
  });

  METER_SPECS.forEach((spec) => {
    const card = document.createElement('div');
    card.className = 'card stat-tile meter-tile';
    card.innerHTML = `
      <div class="meter-row"><span>${spec.label}</span><span class="meter-value-inline">--</span></div>
      <div class="meter-track"><div class="meter-fill"></div></div>
    `;
    proStats.appendChild(card);
    meterEls[spec.key] = {
      fill: card.querySelector('.meter-fill'),
      value: card.querySelector('.meter-value-inline')
    };
  });

  STAT_SPECS.forEach((spec) => {
    const card = document.createElement('div');
    card.className = 'card stat-tile';
    card.innerHTML = `
      <div class="stat-label">${spec.label}</div>
      <div class="stat-value"><span class="stat-num">--</span><span class="stat-unit">${spec.unit}</span></div>
    `;
    proStats.appendChild(card);
    statEls[spec.key] = card.querySelector('.stat-num');
  });
}
buildProPanel();

function updateGauge(key, rawValue) {
  const spec = GAUGE_SPECS.find((s) => s.key === key);
  const els = gaugeEls[key];
  if (!spec || !els) return;
  const value = parseFloat(rawValue);
  const status = gaugeStatusFor(value, spec.zones);
  const fraction = isNaN(value) ? 0 : Math.max(0, Math.min(1, (value - spec.min) / (spec.max - spec.min)));
  els.valuePath.setAttribute('stroke-dasharray', `${(fraction * GAUGE_LEN).toFixed(1)} ${GAUGE_LEN.toFixed(1)}`);
  els.valuePath.style.stroke = STATUS_HEX[status];
  els.num.textContent = isNaN(value) ? '--' : Math.round(value);
  els.status.textContent = STATUS_LABEL[status];
  els.status.style.background = STATUS_HEX[status];
  els.status.style.color = STATUS_TEXT[status];
}

function updateMeter(key, rawValue) {
  const spec = METER_SPECS.find((s) => s.key === key);
  const els = meterEls[key];
  if (!spec || !els) return;
  const value = parseFloat(rawValue);
  const fraction = isNaN(value) ? 0 : Math.max(0, Math.min(1, (value - spec.min) / (spec.max - spec.min)));
  els.fill.style.width = (fraction * 100).toFixed(0) + '%';
  els.value.textContent = isNaN(value) ? '--' : `${Math.round(value)}${spec.unit}`;
}

function updateStat(key, rawValue) {
  const el = statEls[key];
  if (!el) return;
  const value = parseFloat(rawValue);
  el.textContent = isNaN(value) ? '--' : (Number.isInteger(value) ? value : value.toFixed(1));
}

function extraKey(spec) {
  return spec.docName + '.' + spec.field;
}

function formatExtraValue(spec, raw) {
  if (raw === undefined || raw === null || raw === '') return '--';
  if (spec.format === 'text') return String(raw);
  const num = parseFloat(raw);
  if (isNaN(num)) return String(raw);
  let text;
  if (spec.format === 'int-commas') text = Math.round(num).toLocaleString('es-PE');
  else text = Number.isInteger(num) ? String(num) : num.toFixed(1);
  return spec.unit ? `${text} ${spec.unit}` : text;
}

// Crea el tile la primera vez que ese campo realmente llega para este equipo;
// asi el panel solo muestra lo que cada equipo efectivamente reporta.
function upsertExtraTile(spec, raw) {
  const key = extraKey(spec);
  let el = extraTileEls[key];
  if (!el) {
    const card = document.createElement('div');
    card.className = 'card stat-tile';
    card.innerHTML = `<div class="stat-label">${spec.label}</div><div class="stat-value"><span class="extra-val"></span></div>`;
    proExtra.appendChild(card);
    el = card.querySelector('.extra-val');
    extraTileEls[key] = el;
  }
  el.textContent = formatExtraValue(spec, raw);
}

function zeroExtraTileIfExists(spec) {
  const el = extraTileEls[extraKey(spec)];
  if (!el) return; // nunca llego dato real para este campo en este equipo: no crear el tile solo para ponerlo en 0
  el.textContent = spec.format === 'text' ? '--' : formatExtraValue(spec, 0);
}

function updateExtraFields(doc) {
  EXTRA_FIELD_SPECS
    .filter((spec) => spec.docName === doc.name)
    .forEach((spec) => {
      if (!spec.keepLastValue && isProForcedZero()) return;
      upsertExtraTile(spec, doc[spec.field]);
    });
}

function updateAlarms(doc) {
  const active = Object.keys(ALARM_LABELS).filter((k) => {
    const v = doc[k];
    return v !== undefined && v !== null && String(v) !== '0' && v !== false;
  });
  if (!active.length) {
    proAlarms.innerHTML = '<span class="alarm-chip ok">Sin alarmas activas</span>';
    return;
  }
  proAlarms.innerHTML = active.map((k) => `<span class="alarm-chip active">${ALARM_LABELS[k]}</span>`).join('');
}

// Mientras el equipo este Off o desconectado, el Panel Pro se fuerza a 0 -
// excepto voltaje de bateria y nivel de combustible, que siguen mostrando su
// ultimo valor real (son datos de un estado fisico que no desaparece al apagar).
let proLastState = null;
let proConnected = null; // null = todavia no se confirma; true/false = confirmado
const PRO_KEEP_LAST_VALUE = new Set(['fuel', 'voltage']);

function isProForcedZero() { return false; }

function refreshProForcedZero() {
  if (proConnected === false) proTs.textContent = 'Datos atrasados: se conservan las últimas lecturas. Las alarmas no se resuelven por desconexión.';
}

function updateProView(doc) {
  if (doc.name === 'STATE') {
    proLastState = doc.STATE;
    proStateChip.textContent = 'ESTADO: ' + (doc.STATE || '--');
    proStateChip.style.background = stateColor(doc.STATE);
    proTs.textContent = new Date(doc.date).toLocaleString();
    refreshProForcedZero();
    return;
  }

  updateExtraFields(doc);

  // Estos dos siguen actualizando con su ultimo valor real aunque este Off/desconectado
  if (doc.name === 'DD') {
    updateGauge('fuel', doc.FUEL_LEVEL);
    return;
  }
  if (doc.name === 'VEP1') {
    updateGauge('voltage', doc.VOLTAJE_BATERIA);
    return;
  }

  if (isProForcedZero()) return; // el resto se ignora mientras siga Off/desconectado

  if (doc.name === 'EEC1') {
    updateGauge('rpm', doc.RPM_MOTOR);
  } else if (doc.name === 'ET1') {
    updateGauge('coolant', doc.ENG_COOLANT_TEMP);
  } else if (doc.name === 'VF') {
    updateGauge('hydtemp', doc.VF_HYD_TEMP);
  } else if (doc.name === 'CALC') {
    updateMeter('load', doc.ENGINE_LOAD);
  } else if (doc.name === 'HOURS') {
    updateStat('hours', doc.ENG_TOTAL_HOURS);
  } else if (doc.name === 'LFE1') {
    updateStat('fuelrate', doc.ENGINE_FUEL_RATE);
  } else if (doc.name === 'IC1') {
    updateStat('boost', doc.ENG_TURBO_BOOST_PRESS);
  } else if (doc.name === 'AMB') {
    updateStat('ambient', doc.AMBIENT_AIR_TEMP);
  } else if (doc.name === 'LOCATION') {
    updateStat('speed', doc.speed);
  } else if (doc.name === 'ALARM') {
    updateAlarms(doc);
  }
}

function resetProView() {
  proLastState = null;
  proConnected = null;
  GAUGE_SPECS.forEach((spec) => updateGauge(spec.key, NaN));
  METER_SPECS.forEach((spec) => updateMeter(spec.key, NaN));
  STAT_SPECS.forEach((spec) => updateStat(spec.key, NaN));
  proExtra.innerHTML = '';
  Object.keys(extraTileEls).forEach((k) => delete extraTileEls[k]);
  proAlarms.innerHTML = '';
  proStateChip.textContent = 'ESTADO: --';
  proStateChip.style.background = '#999';
  proTs.textContent = '';
}
// ---------- fin Panel Pro ----------

const HIDDEN_CARDS = new Set(['ACK', 'DD1']);

let locationMap = null;
let locationMarker = null;

function courseArrowIcon(course) {
  const deg = Number(course) || 0;
  const html = `
    <div style="transform: rotate(${deg}deg); width:36px; height:36px;">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="17" fill="#1a9a9b" fill-opacity="0.20"/>
        <circle cx="18" cy="18" r="11" fill="#1a9a9b" stroke="#ffffff" stroke-width="2.5"/>
        <path d="M18 8 L24.5 24 L18 19.5 L11.5 24 Z" fill="#ffffff"/>
      </svg>
    </div>`;
  return L.divIcon({ className: '', html, iconSize: [36, 36], iconAnchor: [18, 18] });
}

function renderCard(name) {
  if (cards[name]) return cards[name];
  const card = document.createElement('div');
  card.className = 'card';
  if (name === 'STATE') {
    card.innerHTML = `<h3><span class="state-light" id="stateLight"></span>${name}</h3><div class="fields"></div><div class="ts"></div>`;
    grid.insertBefore(card, grid.firstChild);
  } else if (name === 'LOCATION') {
    card.classList.add('location');
    card.innerHTML = `<h3>${name}</h3><div class="map" id="locationMapDiv"></div><div class="fields"></div><div class="ts"></div>`;
    grid.appendChild(card);
  } else {
    card.innerHTML = `<h3>${name}</h3><div class="fields"></div><div class="ts"></div>`;
    grid.appendChild(card);
  }
  cards[name] = card;
  return card;
}

function updateCard(doc) {
  if (HIDDEN_CARDS.has(doc.name)) return;

  const card = renderCard(doc.name);
  const fieldsDiv = card.querySelector('.fields');
  const tsDiv = card.querySelector('.ts');
  const skip = new Set(['gateway', 'customer', 'name', 'date', 'received_at', 'source']);
  const keys = Object.keys(doc).filter(k => !skip.has(k));
  fieldsDiv.innerHTML = keys.map(k =>
    `<div class="row"><span class="label">${k}</span><span class="value">${doc[k]}</span></div>`
  ).join('') || '<div class="empty">Sin campos</div>';
  tsDiv.textContent = new Date(doc.date).toLocaleString();

  if (doc.name === 'STATE') {
    const light = card.querySelector('#stateLight');
    if (light) light.style.background = stateColor(doc.STATE);
  }

  if (doc.name === 'LOCATION') {
    const lat = parseFloat(doc.latitude);
    const lon = parseFloat(doc.longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      const icon = courseArrowIcon(doc.course);
      if (!locationMap) {
        locationMap = L.map('locationMapDiv').setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(locationMap);
        locationMarker = L.marker([lat, lon], { icon }).addTo(locationMap);
        updateMyMarker();
      } else {
        locationMarker.setLatLng([lat, lon]);
        locationMarker.setIcon(icon);
        if (didFitBounds) locationMap.panTo([lat, lon]);
        fitBothMarkersIfNeeded();
      }
    }
  }
}

function myLocationIcon() {
  const html = `
    <div style="width:22px;height:22px;">
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="#fecc16" fill-opacity="0.3"/>
        <circle cx="11" cy="11" r="6" fill="#fecc16" stroke="#083a4c" stroke-width="2"/>
      </svg>
    </div>`;
  return L.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] });
}

let myMarker = null;
let myPosition = null;
let didFitBounds = false;

function fitBothMarkersIfNeeded() {
  if (didFitBounds || !locationMap || !locationMarker || !myMarker) return;
  const bounds = L.latLngBounds([locationMarker.getLatLng(), myMarker.getLatLng()]);
  locationMap.fitBounds(bounds, { padding: [40, 40] });
  didFitBounds = true;
}

function updateMyMarker() {
  if (!locationMap || !myPosition) return;
  if (!myMarker) {
    myMarker = L.marker([myPosition.lat, myPosition.lon], {
      icon: myLocationIcon(),
      title: 'Tu ubicacion (laptop)'
    }).addTo(locationMap);
    myMarker.bindTooltip('Tu ubicacion');
  } else {
    myMarker.setLatLng([myPosition.lat, myPosition.lon]);
  }
  fitBothMarkersIfNeeded();
}

let myMarkerAll = null;

function updateMyMarkerAll() {
  if (!mapAll || !myPosition) return;
  if (!myMarkerAll) {
    myMarkerAll = L.marker([myPosition.lat, myPosition.lon], {
      icon: myLocationIcon(),
      title: 'Tu ubicacion (laptop)'
    }).addTo(mapAll);
    myMarkerAll.bindTooltip('Tu ubicacion');
  } else {
    myMarkerAll.setLatLng([myPosition.lat, myPosition.lon]);
  }
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      myPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      updateMyMarker();
      updateMyMarkerAll();
    },
    (err) => console.warn('geolocation error:', err.message),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
  );
}

const gwDot = document.getElementById('gwDot');
const gwStatusText = document.getElementById('gwStatusText');

const GW_OFFLINE_THRESHOLD_MS = 30000; // ultimo dato real con mas de 30s de antiguedad => desconectado
let latestDataDateMs = null;
let gwCheckInterval = null;

function setGatewayConnectivity(on, text) {
  gwDot.className = 'gw-dot ' + (on ? 'on' : 'off');
  gwStatusText.textContent = 'equipo: ' + text;
}

// Chequeo de red (ping ICMP directo a la IP del equipo), independiente de si llegan
// datos a Mongo - se calcula en el servidor y se consulta por polling.
const pingDot = document.getElementById('pingDot');
const pingStatusText = document.getElementById('pingStatusText');
let pingStatusCache = {}; // gateway -> { ip, ok, checkedAt }

function renderPingStatus() {
  const entry = pingStatusCache[gatewaySelect.value];
  if (!entry) {
    pingDot.className = 'gw-dot';
    pingStatusText.textContent = 'red: sin IP registrada';
    return;
  }
  pingDot.className = 'gw-dot ' + (entry.ok ? 'on' : 'off');
  const when = new Date(entry.checkedAt).toLocaleTimeString();
  pingStatusText.textContent = 'red: ' + (entry.ok ? `responde (${entry.ip})` : `sin respuesta (${entry.ip})`) + ` · ${when}`;
}

async function refreshPingStatusFromServer() {
  try {
    const res = await fetch('/api/ping-status');
    const data = await res.json();
    pingStatusCache = data.pingStatus || {};
    renderPingStatus();
  } catch (err) {
    console.warn('ping-status fetch error:', err.message);
  }
}

// Fecha del primer dato almacenado para el equipo seleccionado (cambia solo al cambiar de equipo)
const firstDataInfo = document.getElementById('firstDataInfo');
let firstDataCache = {}; // gateway -> ISO string | null

async function refreshFirstDataDate(gateway) {
  if (firstDataCache[gateway] !== undefined) {
    renderFirstDataDate(gateway);
    return;
  }
  firstDataInfo.textContent = 'datos desde: ...';
  try {
    const res = await fetch('/api/first-data-date?gateway=' + encodeURIComponent(gateway));
    const data = await res.json();
    firstDataCache[gateway] = data.firstDate || null;
    renderFirstDataDate(gateway);
  } catch (err) {
    console.warn('first-data-date fetch error:', err.message);
    firstDataInfo.textContent = 'datos desde: --';
  }
}

function renderFirstDataDate(gateway) {
  const val = firstDataCache[gateway];
  firstDataInfo.textContent = 'datos desde: ' + (val ? new Date(val).toLocaleDateString() : 'sin datos');
}

refreshPingStatusFromServer();
setInterval(refreshPingStatusFromServer, 10000);

function noteDataDate(dateStr) {
  const d = new Date(dateStr).getTime();
  if (!isNaN(d) && (latestDataDateMs === null || d > latestDataDateMs)) {
    latestDataDateMs = d;
  }
}

function evaluateConnectivity() {
  if (latestDataDateMs === null) {
    setGatewayConnectivity(false, 'verificando...');
    // todavia no se confirma conectividad: no forzar el Panel Pro a 0 por esto
    return;
  }
  const age = Date.now() - latestDataDateMs;
  if (age <= GW_OFFLINE_THRESHOLD_MS) {
    setGatewayConnectivity(true, 'conectado');
    proConnected = true;
  } else {
    const lastSeen = new Date(latestDataDateMs).toLocaleString();
    setGatewayConnectivity(false, `sin conexion (ultima: ${lastSeen})`);
    proConnected = false;
  }
  refreshProForcedZero();
}

function connect(gateway) {
  if (evtSource) evtSource.close();
  currentStreamedGateway = gateway;
  if (locationMap) {
    locationMap.remove();
    locationMap = null;
    locationMarker = null;
    myMarker = null;
    didFitBounds = false;
  }
  if (gwCheckInterval) clearInterval(gwCheckInterval);
  grid.innerHTML = '';
  cards = {};
  renderCard('STATE');
  resetProView();
  setStatus(false, 'conectando...');
  latestDataDateMs = null;
  setGatewayConnectivity(false, 'verificando...');

  evtSource = new EventSource('/events?gateway=' + encodeURIComponent(gateway));
  evtSource.onopen = () => setStatus(true, 'en vivo: ' + gatewayLabel(gateway));
  evtSource.onerror = () => setStatus(false, 'reconectando...');
  evtSource.addEventListener('snapshot_done', (e) => {
    const data = JSON.parse(e.data);
    noteDataDate(data.lastDate);
    evaluateConnectivity();
  });
  evtSource.onmessage = (e) => {
    const doc = JSON.parse(e.data);
    noteDataDate(doc.date);
    const isLive = !doc._snapshot;
    delete doc._snapshot;
    if (isLive) evaluateConnectivity();
    updateCard(doc);
    updateProView(doc);
  };

  gwCheckInterval = setInterval(evaluateConnectivity, 3000);
}

const viewTeamBtn = document.getElementById('viewTeamBtn');
const viewProBtn = document.getElementById('viewProBtn');
const viewMapBtn = document.getElementById('viewMapBtn');
const viewHistBtn = document.getElementById('viewHistBtn');
const mapAllWrap = document.getElementById('mapAllWrap');
const proWrap = document.getElementById('proWrap');

let viewMode = 'team';
let mapAll = null;
let allMarkers = {}; // gateway -> { marker, lastSeenMs, lastCourse }
let locationsEvtSource = null;
let mapAllCheckInterval = null;
let didFitAllBounds = false;
let locationsSnapshotDone = false;

// Icono fijo tipo bulldozer CAT D8 (imagen provista por el usuario), sin rotar segun el rumbo.
function allGwIcon(connected) {
  const ringColor = connected ? '#2ecc71' : '#e74c3c';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:46px; height:31px;">
        <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:34px; height:34px; border-radius:50%; background:${ringColor}; opacity:0.25;"></div>
        <img src="/tractor-d8.png" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;" />
        <div style="position:absolute; bottom:-1px; right:1px; width:11px; height:11px; border-radius:50%; background:${ringColor}; border:2px solid #ffffff; box-shadow:0 0 4px rgba(0,0,0,.4);"></div>
      </div>`,
    iconSize: [46, 31],
    iconAnchor: [23, 27]
  });
}

function isGatewayConnected(entry) {
  if (!entry || entry.lastSeenMs == null) return false;
  return (Date.now() - entry.lastSeenMs) <= GW_OFFLINE_THRESHOLD_MS;
}

function fitAllMarkersIfNeeded() {
  if (didFitAllBounds || !locationsSnapshotDone) return;
  const markers = Object.values(allMarkers).map(e => e.marker);
  if (!markers.length) return;
  if (markers.length === 1) {
    mapAll.setView(markers[0].getLatLng(), 15);
  } else {
    const group = L.featureGroup(markers);
    mapAll.fitBounds(group.getBounds(), { padding: [40, 40] });
  }
  didFitAllBounds = true;
}

// Solo equipos de mina identificados: excluye TEST y gateways sin nombre asignado
const MINE_GATEWAYS = new Set(
  Object.keys(GATEWAY_NAMES).filter((g) => GATEWAY_NAMES[g] !== 'TEST')
);

function tooltipHtml(gateway, connected, state) {
  const label = gatewayLabel(gateway);
  if (!connected || !state) return label;
  const color = stateColor(state);
  return `${label} <span class="gw-state-badge" style="background:${color};">${state}</span>`;
}

function refreshMarkerVisual(gateway, entry) {
  const connected = isGatewayConnected(entry);
  entry.marker.setIcon(allGwIcon(connected));
  entry.marker.setTooltipContent(tooltipHtml(gateway, connected, entry.state));
}

function ensureMarker(gateway, lat, lon) {
  let entry = allMarkers[gateway];
  if (entry) return entry;
  const marker = L.marker([lat, lon], { icon: allGwIcon(true) }).addTo(mapAll);
  marker.bindTooltip(gatewayLabel(gateway), {
    permanent: true,
    direction: 'top',
    className: 'gw-label-tooltip',
    offset: [0, -14]
  });
  marker.on('click', () => {
    gatewaySelect.value = gateway;
    switchView('team');
  });
  entry = { marker, lastSeenMs: null, state: null, rawLat: lat, rawLon: lon };
  allMarkers[gateway] = entry;
  fitAllMarkersIfNeeded();
  return entry;
}

// Cuando dos o mas equipos reportan casi la misma ubicacion (ej. parqueados juntos
// en el taller), sus marcadores quedan exactamente uno encima del otro y el de abajo
// desaparece visualmente. Aqui se detectan esos grupos por proximidad real (rawLat/
// rawLon) y se reparten en un pequeno circulo alrededor del centro para que todos
// queden visibles sin necesidad de hacer zoom manual.
const OVERLAP_THRESHOLD_DEG = 0.0006; // ~65m
const OVERLAP_SPREAD_DEG = 0.0004; // ~45m de radio al repartir

function applyOverlapOffsets() {
  Object.values(allMarkers).forEach(entry => entry.marker.setLatLng([entry.rawLat, entry.rawLon]));
}

function upsertAllMarker(doc) {
  const gateway = doc.gateway;
  if (!MINE_GATEWAYS.has(gateway)) return;
  const dateMs = new Date(doc.date).getTime();

  if (doc.name === 'LOCATION') {
    const lat = parseFloat(doc.latitude);
    const lon = parseFloat(doc.longitude);
    if (isNaN(lat) || isNaN(lon)) return;
    const entry = ensureMarker(gateway, lat, lon);
    entry.rawLat = lat;
    entry.rawLon = lon;
    if (!isNaN(dateMs)) entry.lastSeenMs = Math.max(entry.lastSeenMs || 0, dateMs);
    refreshMarkerVisual(gateway, entry);
    applyOverlapOffsets();
  } else if (doc.name === 'STATE') {
    const entry = allMarkers[gateway];
    if (!entry) return; // aun no llega la ubicacion, no hay marcador donde mostrar el estado
    entry.state = doc.STATE;
    if (!isNaN(dateMs)) entry.lastSeenMs = Math.max(entry.lastSeenMs || 0, dateMs);
    refreshMarkerVisual(gateway, entry);
  }
}

function evaluateAllConnectivity() {
  Object.entries(allMarkers).forEach(([gateway, entry]) => refreshMarkerVisual(gateway, entry));
}

function connectLocations() {
  if (locationsEvtSource) locationsEvtSource.close();
  locationsSnapshotDone = false;
  locationsEvtSource = new EventSource('/events/locations');
  locationsEvtSource.onmessage = (e) => {
    const doc = JSON.parse(e.data);
    upsertAllMarker(doc);
  };
  locationsEvtSource.addEventListener('snapshot_done', () => {
    locationsSnapshotDone = true;
    fitAllMarkersIfNeeded();
  });
}

function switchView(mode) {
  viewMode = mode;
  viewTeamBtn.classList.toggle('active', mode === 'team');
  viewProBtn.classList.toggle('active', mode === 'pro');
  viewMapBtn.classList.toggle('active', mode === 'map');
  viewHistBtn.classList.toggle('active', mode === 'hist');

  mapAllWrap.style.display = mode === 'map' ? '' : 'none';
  histWrap.style.display = mode === 'hist' ? '' : 'none';
  gatewaySelect.style.display = mode === 'map' ? 'none' : '';

  updateProWrapPlacement();
  updateGridPlacement();

  if (mode === 'map') {
    if (evtSource) evtSource.close();
    // gwCheckInterval (evaluateConnectivity) es solo para 'team'/'pro'; si sigue
    // corriendo aqui, tras ~30s sin datos fuerza a 0 el Panel Pro (#proWrap).
    if (gwCheckInterval) { clearInterval(gwCheckInterval); gwCheckInterval = null; }

    if (!mapAll) {
      mapAll = L.map('mapAllDiv').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapAll);
    }
    setTimeout(() => mapAll.invalidateSize(), 0);
    updateMyMarkerAll();

    connectLocations();
    if (mapAllCheckInterval) clearInterval(mapAllCheckInterval);
    mapAllCheckInterval = setInterval(evaluateAllConnectivity, 3000);
  } else if (mode === 'hist') {
    // No hay stream en vivo mientras se ve el historial
    if (evtSource) evtSource.close();
    if (gwCheckInterval) { clearInterval(gwCheckInterval); gwCheckInterval = null; }
    if (locationsEvtSource) { locationsEvtSource.close(); locationsEvtSource = null; }
    if (mapAllCheckInterval) { clearInterval(mapAllCheckInterval); mapAllCheckInterval = null; }
  } else {
    // 'team' y 'pro' comparten el mismo stream por gateway (/events)
    if (locationsEvtSource) { locationsEvtSource.close(); locationsEvtSource = null; }
    if (mapAllCheckInterval) { clearInterval(mapAllCheckInterval); mapAllCheckInterval = null; }
    const streamIsOpen = evtSource && evtSource.readyState !== EventSource.CLOSED;
    if (!streamIsOpen || currentStreamedGateway !== gatewaySelect.value) {
      connect(gatewaySelect.value);
    }
  }
}

viewTeamBtn.addEventListener('click', () => switchView('team'));
viewProBtn.addEventListener('click', () => switchView('pro'));
viewMapBtn.addEventListener('click', () => switchView('map'));
viewHistBtn.addEventListener('click', () => switchView('hist'));

// ---------- Historial: Instante + Rango ----------
const histWrap = document.getElementById('histWrap');
const histInstantBtn = document.getElementById('histInstantBtn');
const histRangeBtn = document.getElementById('histRangeBtn');
const histInstantPanel = document.getElementById('histInstantPanel');
const histRangePanel = document.getElementById('histRangePanel');
const histInstantStatus = document.getElementById('histInstantStatus');
const histRangeStatus = document.getElementById('histRangeStatus');
const histSeriesPicker = document.getElementById('histSeriesPicker');
const histChartsContainer = document.getElementById('histCharts');
const histChartInstances = {};

let histSubMode = 'instant';

function updateProWrapPlacement() {
  proWrap.style.display = (viewMode === 'pro') ? '' : 'none';
}

// El grid "Por equipo" (mismas tarjetas con todos los campos crudos) se reutiliza
// tal cual para el submodo Instante del Historial: misma funcion updateCard que ya
// procesa cualquier tipo de documento en vivo, solo cambia la fuente de datos
// (fetch puntual en vez de SSE).
function updateGridPlacement() {
  const showInHist = viewMode === 'hist' && histSubMode === 'instant';
  if (showInHist) {
    if (grid.parentElement !== histInstantPanel) {
      histInstantPanel.appendChild(grid);
    }
    grid.style.display = '';
  } else {
    if (grid.parentElement !== document.body) {
      document.body.insertBefore(grid, histWrap);
    }
    grid.style.display = (viewMode === 'team') ? '' : 'none';
  }
}

function switchHistSubMode(sub) {
  histSubMode = sub;
  histInstantBtn.classList.toggle('active', sub === 'instant');
  histRangeBtn.classList.toggle('active', sub === 'range');
  histInstantPanel.style.display = sub === 'instant' ? '' : 'none';
  histRangePanel.style.display = sub === 'range' ? '' : 'none';
  updateGridPlacement();
}
histInstantBtn.addEventListener('click', () => switchHistSubMode('instant'));
histRangeBtn.addEventListener('click', () => switchHistSubMode('range'));

// Los inputs datetime-local se escriben en hora local del navegador (Lima, UTC-5)
// y "new Date(value)" ya los interpreta asi automaticamente - .toISOString() los
// convierte a UTC correctamente para consultar Mongo (que guarda todo en UTC, igual
// que el reloj del OWASYS). formatUTC() se usa solo para mostrar, ademas de la hora
// local, el instante UTC exacto que realmente se consulto (util para comparar contra
// timestamps crudos del dispositivo, que vienen en UTC).
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatUTC(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

async function loadHistInstant() {
  const gateway = gatewaySelect.value;
  const atInput = document.getElementById('histInstantAt').value;
  if (!atInput) { histInstantStatus.textContent = 'Selecciona una fecha y hora.'; return; }
  const atDate = new Date(atInput);
  histInstantStatus.textContent = 'Cargando...';
  if (locationMap) {
    locationMap.remove();
    locationMap = null;
    locationMarker = null;
    myMarker = null;
    didFitBounds = false;
  }
  grid.innerHTML = '';
  cards = {};
  renderCard('STATE');
  try {
    const params = new URLSearchParams({ gateway, at: atDate.toISOString() });
    const res = await fetch('/api/history/instant?' + params.toString());
    const data = await res.json();
    const docs = (data.docs || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    docs.forEach((doc) => updateCard(doc));
    if (docs.length) {
      histInstantStatus.textContent = `Estado del equipo al ${atDate.toLocaleString()} (${formatUTC(atDate)}) - ${docs.length} tipos de dato encontrados`;
    } else {
      histInstantStatus.textContent = 'No hay datos para este equipo antes de esa fecha.';
    }
  } catch (err) {
    histInstantStatus.textContent = 'Error al cargar: ' + err.message;
  }
}
document.getElementById('histInstantLoadBtn').addEventListener('click', loadHistInstant);

// Mismas 11 series numericas que ya se grafican en vivo en el Panel Pro
const HIST_SERIES_SPECS = [...GAUGE_SPECS, ...METER_SPECS, ...STAT_SPECS];

function buildHistSeriesPicker() {
  histSeriesPicker.innerHTML = HIST_SERIES_SPECS.map((spec) =>
    `<label><input type="checkbox" class="hist-series-cb" value="${spec.key}" checked> ${spec.label}</label>`
  ).join('');
}
buildHistSeriesPicker();

function histSpecForKey(key) {
  return HIST_SERIES_SPECS.find((s) => s.key === key);
}

function renderHistCharts(seriesData, selectedKeys) {
  Object.keys(histChartInstances).forEach((key) => {
    if (!selectedKeys.includes(key)) {
      histChartInstances[key].destroy();
      delete histChartInstances[key];
      const oldCard = document.getElementById('histCard-' + key);
      if (oldCard) oldCard.remove();
    }
  });

  selectedKeys.forEach((key) => {
    const spec = histSpecForKey(key);
    if (!spec) return;
    const points = seriesData[key] || [];
    const labels = points.map((p) => new Date(p.t).toLocaleString('es-PE', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    const values = points.map((p) => p.v);

    let card = document.getElementById('histCard-' + key);
    if (!card) {
      card = document.createElement('div');
      card.className = 'card hist-chart-card';
      card.id = 'histCard-' + key;
      card.innerHTML = `<div class="hist-chart-title">${spec.label} (${spec.unit})</div><canvas></canvas>`;
      histChartsContainer.appendChild(card);
    }
    const canvas = card.querySelector('canvas');

    if (histChartInstances[key]) {
      histChartInstances[key].data.labels = labels;
      histChartInstances[key].data.datasets[0].data = values;
      histChartInstances[key].update();
    } else {
      histChartInstances[key] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: '#1a9a9b',
            backgroundColor: 'rgba(26,154,155,0.14)',
            pointRadius: 0,
            borderWidth: 1.5,
            tension: 0.15,
            fill: true
          }]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 6, autoSkip: true }, grid: { display: false } },
            y: { grid: { color: 'rgba(128,128,128,0.15)' } }
          }
        }
      });
    }
  });
}

const STATE_LEGEND_ORDER = ['duty', 'keyon', 'idle', 'off'];
const STATE_LEGEND_LABELS = { off: 'Off', idle: 'Idle', keyon: 'KeyOn', duty: 'Duty' };
const SIN_DATOS_COLOR = '#bbbbbb';

function buildStateSegments(points, toDate) {
  if (!points.length) return [];
  const segments = [];
  for (let i = 0; i < points.length; i++) {
    const startMs = new Date(points[i].t).getTime();
    const endMs = i + 1 < points.length ? new Date(points[i + 1].t).getTime() : toDate.getTime();
    if (endMs <= startMs) continue;
    segments.push({ state: points[i].state, startMs, endMs });
  }
  return segments;
}

// Suma la duracion cubierta por cada estado dentro de [fromMs, toMs]; el tiempo que
// no tiene ningun segmento (ej. antes del primer dato) se contabiliza como "sin_datos"
// para que el pie siempre sume el 100% del rango pedido.
function computeStateDurations(segments, fromMs, toMs) {
  const totals = {};
  let coveredMs = 0;
  segments.forEach((seg) => {
    const start = Math.max(seg.startMs, fromMs);
    const end = Math.min(seg.endMs, toMs);
    if (end <= start) return;
    const key = String(seg.state || '').toLowerCase();
    totals[key] = (totals[key] || 0) + (end - start);
    coveredMs += (end - start);
  });
  const totalRangeMs = Math.max(0, toMs - fromMs);
  const uncoveredMs = totalRangeMs - coveredMs;
  if (uncoveredMs > 0) totals.sin_datos = (totals.sin_datos || 0) + uncoveredMs;
  return { totals, totalRangeMs };
}

function formatDurationHours(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

let stateChartInstance = null;

function renderStateSummary(totals, totalRangeMs, fromDate, toDate) {
  const statsEl = document.getElementById('histStateStats');
  const totalEl = document.getElementById('histStateTotal');
  totalEl.textContent = `Total del rango: ${formatDurationHours(totalRangeMs)} (${fromDate.toLocaleString()} - ${toDate.toLocaleString()})`;

  const keys = [...STATE_LEGEND_ORDER, 'sin_datos'].filter((k) => totals[k] > 0);
  const labels = keys.map((k) => k === 'sin_datos' ? 'Sin datos' : STATE_LEGEND_LABELS[k]);
  const colors = keys.map((k) => k === 'sin_datos' ? SIN_DATOS_COLOR : STATE_COLORS[k]);
  const values = keys.map((k) => totals[k] || 0);

  statsEl.innerHTML = keys.map((k, i) => {
    const pct = totalRangeMs ? (values[i] / totalRangeMs * 100) : 0;
    return `<div class="state-summary-item"><i style="background:${colors[i]}"></i>${labels[i]} - ${formatDurationHours(values[i])}<span class="state-summary-pct">${pct.toFixed(1)}%</span></div>`;
  }).join('') || '<div class="state-summary-item">Sin datos de estado en este rango</div>';

  const canvas = document.getElementById('histStatePie');
  if (stateChartInstance) stateChartInstance.destroy();
  if (!keys.length) return;
  stateChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = totalRangeMs ? (ctx.parsed / totalRangeMs * 100) : 0;
              return `${ctx.label}: ${formatDurationHours(ctx.parsed)} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

function renderStateTimeline(statePoints, fromDate, toDate) {
  let card = document.getElementById('histStateCard');
  if (!card) {
    card = document.createElement('div');
    card.className = 'card hist-chart-card hist-state-card';
    card.id = 'histStateCard';
    card.innerHTML = `
      <div class="hist-chart-title">Estado (permite identificar cuando estuvo apagado)</div>
      <div class="state-timeline" id="histStateTimeline"></div>
      <div class="state-timeline-legend">${STATE_LEGEND_ORDER.map((s) =>
        `<span><i style="background:${STATE_COLORS[s]}"></i>${STATE_LEGEND_LABELS[s]}</span>`
      ).join('')}</div>
      <div class="state-summary-row">
        <div class="state-pie-wrap"><canvas id="histStatePie"></canvas></div>
        <div class="state-summary-stats">
          <div class="state-summary-total" id="histStateTotal"></div>
          <div id="histStateStats"></div>
        </div>
      </div>
    `;
    histChartsContainer.insertBefore(card, histChartsContainer.firstChild);
  }
  const timelineEl = document.getElementById('histStateTimeline');
  const segments = buildStateSegments(statePoints || [], toDate);
  const { totals, totalRangeMs } = computeStateDurations(segments, fromDate.getTime(), toDate.getTime());
  renderStateSummary(totals, totalRangeMs, fromDate, toDate);

  if (!segments.length) {
    timelineEl.innerHTML = '<div class="state-timeline-empty">Sin datos de estado en este rango</div>';
    return;
  }
  timelineEl.innerHTML = segments.map((seg) => {
    const durationMin = (seg.endMs - seg.startMs) / 60000;
    const label = `${STATE_LEGEND_LABELS[String(seg.state || '').toLowerCase()] || seg.state || '--'}: ${new Date(seg.startMs).toLocaleString()} - ${new Date(seg.endMs).toLocaleString()}`;
    return `<div class="state-timeline-seg" style="flex-grow:${durationMin};background:${stateColor(seg.state)};" title="${label}"></div>`;
  }).join('');
}

let trackMap = null;
let trackPolyline = null;
let trackStartMarker = null;
let trackEndMarker = null;

function renderHistTrack(points, fromDate, toDate) {
  let card = document.getElementById('histTrackCard');
  if (!card) {
    card = document.createElement('div');
    card.className = 'card hist-chart-card hist-state-card';
    card.id = 'histTrackCard';
    card.innerHTML = `
      <div class="hist-chart-title">Ruta recorrida</div>
      <div class="map" id="histTrackMapDiv" style="height:360px;"></div>
      <div class="hist-note" id="histTrackNote"></div>
    `;
    histChartsContainer.insertBefore(card, histChartsContainer.firstChild);
  }
  const note = document.getElementById('histTrackNote');

  if (!trackMap) {
    trackMap = L.map('histTrackMapDiv');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(trackMap);
  }
  setTimeout(() => trackMap.invalidateSize(), 0);

  if (trackPolyline) { trackMap.removeLayer(trackPolyline); trackPolyline = null; }
  if (trackStartMarker) { trackMap.removeLayer(trackStartMarker); trackStartMarker = null; }
  if (trackEndMarker) { trackMap.removeLayer(trackEndMarker); trackEndMarker = null; }

  const coords = points.map((p) => [p.lat, p.lon]);
  if (!coords.length) {
    note.textContent = 'Sin datos de ubicacion (GPS) en este rango.';
    trackMap.setView([0, 0], 2);
    return;
  }

  trackPolyline = L.polyline(coords, { color: '#1a9a9b', weight: 3 }).addTo(trackMap);
  trackStartMarker = L.circleMarker(coords[0], { radius: 6, color: '#188038', fillColor: '#188038', fillOpacity: 1 })
    .addTo(trackMap)
    .bindTooltip('Inicio: ' + new Date(points[0].t).toLocaleString());
  trackEndMarker = L.circleMarker(coords[coords.length - 1], { radius: 6, color: '#d93025', fillColor: '#d93025', fillOpacity: 1 })
    .addTo(trackMap)
    .bindTooltip('Fin: ' + new Date(points[points.length - 1].t).toLocaleString());
  trackMap.fitBounds(trackPolyline.getBounds(), { padding: [30, 30] });

  note.textContent = `${points.length} puntos GPS entre ${fromDate.toLocaleString()} y ${toDate.toLocaleString()}`;
}

async function loadHistRange() {
  const gateway = gatewaySelect.value;
  const fromVal = document.getElementById('histFrom').value;
  const toVal = document.getElementById('histTo').value;
  if (!fromVal || !toVal) { histRangeStatus.textContent = 'Selecciona fecha/hora de inicio y fin.'; return; }
  const fromDate = new Date(fromVal);
  const toDate = new Date(toVal);
  if (fromDate >= toDate) { histRangeStatus.textContent = 'La fecha de inicio debe ser anterior a la de fin.'; return; }
  const selectedKeys = Array.from(document.querySelectorAll('.hist-series-cb:checked')).map((cb) => cb.value);
  if (!selectedKeys.length) { histRangeStatus.textContent = 'Selecciona al menos una serie.'; return; }

  histRangeStatus.textContent = 'Cargando...';
  try {
    const params = new URLSearchParams({
      gateway, from: fromDate.toISOString(), to: toDate.toISOString(), series: selectedKeys.join(',')
    });
    const trackParams = new URLSearchParams({ gateway, from: fromDate.toISOString(), to: toDate.toISOString() });
    const [res, trackRes] = await Promise.all([
      fetch('/api/history/range?' + params.toString()),
      fetch('/api/history/track?' + trackParams.toString())
    ]);
    const data = await res.json();
    const trackData = await trackRes.json();
    renderHistTrack(trackData.points || [], fromDate, toDate);
    renderStateTimeline(data.state || [], fromDate, toDate);
    renderHistCharts(data.series || {}, selectedKeys);
    const bucketNote = data.bucketMs ? `agrupado en bloques de ${Math.round(data.bucketMs / 60000)} min` : 'puntos crudos';
    histRangeStatus.textContent = `Datos entre ${fromDate.toLocaleString()} y ${toDate.toLocaleString()} (${formatUTC(fromDate)} - ${formatUTC(toDate)}, ${bucketNote})`;
  } catch (err) {
    histRangeStatus.textContent = 'Error al cargar: ' + err.message;
  }
}
document.getElementById('histRangeLoadBtn').addEventListener('click', loadHistRange);

(function initHistDefaults() {
  const now = new Date();
  document.getElementById('histInstantAt').value = toDatetimeLocalValue(now);
  document.getElementById('histTo').value = toDatetimeLocalValue(now);
  document.getElementById('histFrom').value = toDatetimeLocalValue(new Date(now.getTime() - 60 * 60 * 1000));
})();
// ---------- fin Historial ----------

async function init() {
  const res = await fetch('/api/gateways');
  const { gateways } = await res.json();
  const sorted = gateways.slice().sort((a, b) => gatewayLabel(a).localeCompare(gatewayLabel(b)));
  gatewaySelect.innerHTML = sorted.map(g => `<option value="${g}">${gatewayLabel(g)}</option>`).join('');
  const requested = new URLSearchParams(location.search).get('gateway');
  const preferred = gateways.includes(requested) ? requested : gateways.includes('A16Q28') ? 'A16Q28' : gateways[0];
  if (!preferred) return;
  gatewaySelect.value = preferred;
  connect(preferred);
  renderPingStatus();
  refreshFirstDataDate(preferred);
}

gatewaySelect.addEventListener('change', () => {
  renderPingStatus();
  refreshFirstDataDate(gatewaySelect.value);
  // Solo 'team'/'pro' usan el stream en vivo; en 'hist' (y 'map', donde el
  // selector esta oculto) no debe abrirse una conexion en vivo que luego
  // sobrescriba silenciosamente lo que se cargo del historial.
  if (viewMode === 'team' || viewMode === 'pro') {
    connect(gatewaySelect.value);
  } else if (evtSource) {
    evtSource.close();
    evtSource = null;
    currentStreamedGateway = null;
  }
});

init().catch(() => setStatus(false, 'Fuente de datos no disponible'));
