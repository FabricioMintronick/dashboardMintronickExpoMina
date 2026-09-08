import {machineImage} from './machine.js';
import {escape as e,age} from './format.js';
import {attentionReason} from './home-insights.js';
const thermometer='<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v10M17 5h3M17 9h2"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/>';
const gauge='<path d="M4 19a9 9 0 1 1 16 0M12 13l5-5M5 13h2M12 4v2M17 13h2"/><circle cx="12" cy="13" r="2"/>';
const fuel='<path d="M4 21V4h10v17M3 21h12M6 7h6v5H6zM14 9h3l3 4v5a2 2 0 0 1-4 0v-3M18 5l3 3v5"/>';
const battery='<path d="M3 7h18v13H3zM6 7V4h3v3M15 7V4h3v3M6 13h4M8 11v4M15 13h3"/>';
const signal='<path d="M4 19v-3M9 19v-7M14 19V8M19 19V4M3 3l18 18"/>';
const generic='<path d="m12 3 10 18H2zM12 9v5M12 17v1"/>';
export function alarmSymbol(code){const path=/TEMP|HEATING/.test(code)?thermometer:/SPEED|RPM|LOAD/.test(code)?gauge:/FUEL/.test(code)?fuel:/BATTERY/.test(code)?battery:code==='offline'?signal:generic;return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;}
const shortLabels={HYD_OVERHEATING:'Hidráulica',TC_OVERHEATING:'Convertidor',OVERHEATING:'Refrigerante',OVERSPEED:'Velocidad',LOW_FUEL:'Combustible',LOW_BATTERY:'Batería baja',HIGH_BATTERY:'Batería alta',HIGH_LOAD_LOW_RPM:'Carga / RPM',LOW_BOOST:'Turbo',AIR_FILTER_CLOGGED:'Filtro',EXCESSIVE_IDLE:'Ralentí',HARSH_EVENT:'Movimiento'};
export function attentionCard(item){const reason=attentionReason(item);if(!reason)return '';const alarms=item.alarms.filter(a=>reason.kind==='alarm'?a.quality==='fresh':true);return `<button data-notifications data-notification-equipment="${e(item.id)}" class="attention-machine reason-${reason.kind}" aria-label="${e(item.name)}: ${e(reason.label)}. ${e(reason.description)}"><div class="attention-machine-head">${machineImage(item)}<span><b>${e(item.name)}</b></span><strong>${reason.kind==='offline'?alarmSymbol('offline'):alarms.length}</strong></div><div class="attention-symbols">${reason.kind==='offline'?`<span class="offline-symbol">${alarmSymbol('offline')}<b>${e(age(item.lastAt))}</b></span>`:alarms.map(a=>`<span title="${e(a.label)} · ${e(age(a.at))}">${alarmSymbol(a.code)}<b>${e(shortLabels[a.code]||a.label)}</b></span>`).join('')}</div></button>`;}
