import {setupTheme} from './theme.js';
import {commandCenter} from './home-dashboard.js';
import {operationalStateIndex,stateDefinitions} from './home-insights.js';
import { icon, openEquipment, openNotifications, observeAlarms } from './ui.js';
import { homeView, detailView, equipmentCards } from './visual.js';
import {fleetAnalytics} from './analytics.js';
import { getJSON } from './api.js';
import './pwa.js';
import { escape as e, number, date, age, badge, quality, state, condition } from './format.js';
function chartTextSize() {
  return window.innerWidth <= 900 ? 14 : window.innerWidth <= 1366 ? 12 : 11;
}
function applyChartTextSize() {
  if (!window.Chart) return;
  const size = chartTextSize();
  Chart.defaults.font.size = size;
  Chart.defaults.plugins.tooltip.titleFont = { size: size + 1, weight: 'bold' };
  Chart.defaults.plugins.tooltip.bodyFont = { size };
  Object.values(Chart.instances || {}).forEach(chart => {
    chart.options.font = { ...(chart.options.font || {}), size };
    chart.resize();
    chart.update('none');
  });
}
applyChartTextSize();
let chartResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(applyChartTextSize, 180);
});
const routes = {
  home: ['⌂','Inicio','Centro de control'],
  equipment: ['▦','Equipos','Tus equipos',''],
  map: ['⌖','Mapa GPS','Ubicación de la flota',''],
  alerts: ['△','Alertas','Alarmas reportadas',''],
  history: ['◷','Historial','Explorar el historial'],
  reports: ['▤','Reportes','Centro de reportes'],
  sensors: ['⌁','Sensores','Sensores en campo','Posición angular y distancia recibidas desde los gateways.'],
  install: ['⇩','Aplicación','Aplicaciones Android','Descarga MinTronick Operaciones o MinTronick Sync.']
  /*maintenance: ['⚒','Mantenimiento','Planificación de mantenimiento','Horómetros disponibles y requisitos para activar planes preventivos.']*/
};
const iconMarkup = icon;
const page = document.querySelector('#page');
let fleet = null, error = null, busy = false, cleanup = () => {}, routeVersion = 0;
document.querySelector('#navigation').innerHTML = Object.entries(routes).map(([key,[icon,label]]) => `<a href="#${key}" data-route="${key}"><span class="icon" aria-hidden="true">${iconMarkup(key)}</span>${label}</a>`).join('');
function selection() { const [route = 'home', id] = location.hash.slice(1).split('?')[0].split('/'); return { route: routes[route] ? route : 'home', id: id ? decodeURIComponent(id) : null }; }
function assets() { return (fleet?.equipment || []).filter(item => !item.test); }
function link(item) { return `#equipment/${encodeURIComponent(item.id)}`; }
function equipmentTable(items) {
  if (!items.length) return '<div class="empty"><strong>No hay equipos para mostrar</strong>Prueba otro filtro o comprueba la fuente de datos.</div>';
  return `<div class="table-scroll"><table><thead><tr><th>EQUIPO</th><th>ESTADO OPERATIVO</th><th>COMUNICACIÓN</th><th>CONDICIÓN</th><th></th></tr></thead><tbody>${items.map(item => `<tr><td><a class="asset" href="${link(item)}">${e(item.name)}</a><small>${e(item.model)} · ${e(item.gateway)}</small></td><td>${state(item)}</td><td>${quality(item.communication)}<small>${e(age(item.lastAt))}</small></td><td>${condition(item)}</td><td><a href="${link(item)}" aria-label="Ver ${e(item.name)}">↗</a></td></tr>`).join('')}</tbody></table></div>`;
}
function panel(title, subtitle, content, action = '') { return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>${content}</section>`; }
function compactExplanations() {
  page.querySelectorAll('.notice').forEach(note => {
    if (note.textContent.length < 190) return;
    const details = document.createElement('details');
    details.className = 'data-notes';
    const summary = document.createElement('summary');
    summary.textContent = note.classList.contains('warning') ? 'ⓘ Alcance y advertencias de esta vista' : 'ⓘ Cómo interpretar esta información';
    note.replaceWith(details); details.append(summary, note);
  });
}
function home() { cleanup = commandCenter(page, { items: assets(), fleet, panel }); }
function equipment() {
  let model='all',lastDirectorySignature='';
  page.innerHTML = `<div class="toolbar"><label class="grow">Buscar equipo<input id="search" type="search" placeholder="Nombre, modelo o gateway…"></label></div><div class="fleet-section-heading"><h2>Directorio de equipos</h2></div><div id="equipment-table"></div>`;
  const draw = () => {
    const query = document.querySelector('#search').value.toLowerCase();
    const stateFilter = new URLSearchParams(location.hash.split('?')[1]).get('state');
    const items = assets().filter(i => (model==='all'||i.model===model) && `${i.name} ${i.model} ${i.gateway}`.toLowerCase().includes(query) && (!stateFilter || stateDefinitions[operationalStateIndex(i)][0]===stateFilter));
    const signature=items.map(i=>`${i.id}:${i.communication}:${i.state?.value}:${i.state?.since}:${i.metrics.hours.value}:${i.metrics.fuel.value}:${i.alarms.length}:${i.alarmQuality}`).join('|');
    if(signature!==lastDirectorySignature){document.querySelector('#equipment-table').innerHTML = equipmentCards(items);lastDirectorySignature=signature;}
  };
  document.querySelector('#search').addEventListener('input',draw); draw();
  const overview=document.createElement('div');overview.className='directory-overview';page.prepend(overview);const pills=document.createElement('div');pills.className='preset-row';overview.after(pills);pills.innerHTML='<button data-model="all">Todos los modelos</button>'+[...new Set(assets().map(i=>i.model))].map(m=>'<button data-model="'+e(m)+'">'+e(m)+'</button>').join('');pills.onclick=event=>{const b=event.target.closest('[data-model]');if(b){model=b.dataset.model;pills.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));draw();}};const summary=()=>overview.innerHTML='<span><b>'+assets().length+'</b> equipos</span><span><b>'+assets().filter(i=>i.communication==='fresh').length+'</b> con datos</span><span><b>'+assets().filter(i=>i.alarms.some(a=>a.quality==='fresh')).length+'</b> con alarma vigente</span>';summary();cleanup=()=>{};cleanup.update=()=>{summary();draw();};
}
function detail(id) {
  const item=fleet.equipment.find(i=>i.id===id);
  if(!item){page.innerHTML='<div class="empty">Equipo no encontrado. <a href="#equipment">Volver</a></div>';return;}
  document.querySelector('#page-title').textContent=item.name;
  const description=document.querySelector('#page-description');
  description.hidden=false;
  description.textContent='Estado y telemetría del equipo';
  cleanup=detailView(page,{item,panel});
}
async function render() {
  document.querySelector('#back-button').hidden=selection().route==='home';
  cleanup(); cleanup = () => {}; const version = ++routeVersion;
  const { route, id } = selection();
  document.querySelector('#page-title').textContent = routes[route][2];
  const description=document.querySelector('#page-description');
  description.textContent=routes[route][3]||'';
  description.hidden=!routes[route][3];
  document.querySelector('#breadcrumb').textContent = `Operaciones / ${routes[route][1]}`;
  if(fleet && !error) document.querySelector('#connection').textContent = 'Información actualizada automáticamente';
  document.querySelectorAll('[data-route]').forEach(a => {a.classList.toggle('active',a.dataset.route === route); if(a.dataset.route === route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if (!fleet || error) { page.innerHTML = `<div class="error-box"><h2>${busy ? 'Preparando la información de tu flota' : 'No pudimos consultar los datos'}</h2><p>${e(error || 'La interfaz está conectando con la API. No se muestran equipos simulados.')}</p>${busy ? '' : '<button class="button secondary" id="retry">Reintentar consulta</button>'}</div>`; document.querySelector('#retry')?.addEventListener('click',()=>refresh(false)); return; }
  if(route==='home')home(); else if(route==='equipment') id ? detail(id) : equipment(); 
  else {
    page.innerHTML = '<div class="empty">Preparando vista…</div>';
    try {
      const module = await import(`./${route==='map'?'map-explorer':route==='history'?'compare-history':route==='reports'?'report-studio':route}.js`);
      if(version !== routeVersion)return;
      cleanup = await module.mount(page, { fleet, items:assets(), id, panel, equipmentTable, getJSON }) || (()=>{});
    } catch(err) { if(version===routeVersion)page.innerHTML=`<div class="error-box"><h2>No se pudo abrir esta vista</h2><p>${e(err.message)}</p></div>`; }
  }
  compactExplanations();
}
async function refresh(background = false) {
  if(busy)return; busy=true;
  const status=document.querySelector('#connection'), previousStatus=status.textContent; if(!background)status.textContent='Consultando la fuente de datos…';
  if(!fleet)render();
  try {fleet=await getJSON('/api/fleet');observeAlarms(fleet.equipment.filter(i=>!i.test));error=null;status.className='connection sr-only ok';status.textContent='Información actualizada automáticamente';}
  catch(err){error=err.message;status.className='connection sr-only error';status.textContent='Fuente de datos no disponible';}
  finally{busy=false;if(!error){if(page.querySelector('.error-box')||!page.children.length)render();else {cleanup.update?.(assets());window.dispatchEvent(new CustomEvent('fleet-update',{detail:fleet}));}status.textContent='Información actualizada automáticamente';}else if(!fleet)render();}
}
window.addEventListener('hashchange',render);
let refreshTimer=null;
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(!document.hidden)await refresh(true);scheduleRefresh();},document.hidden?30000:5000);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);scheduleRefresh();});
scheduleRefresh();


const topbar=document.querySelector('.topbar');
topbar.insertAdjacentHTML('afterbegin','<div class="nav-actions"><button id="nav-toggle" class="icon-button" aria-label="Abrir menú" aria-expanded="false">'+icon('menu')+'</button><button id="back-button" class="icon-button" aria-label="Regresar">'+icon('back')+'<span>Regresar</span></button></div><a class="mobile-brand" href="#home"><img src="/assets/LOGO_Transparente.png" alt="MinTronick"></a>');
topbar.querySelector('.topbar-controls').insertAdjacentHTML('afterbegin','<button class="icon-button" data-notifications aria-label="Abrir alertas">'+icon('bell')+'<b id="bell-count">0</b></button>');
const sessionActions=document.querySelector('#session-actions');
sessionActions.innerHTML='<details class="sidebar-tools"><summary><span class="sidebar-more" aria-hidden="true">•••</span><span>Vista</span></summary><div class="sidebar-tool-list"><button class="sidebar-tool" id="fullscreen-toggle" aria-label="Activar pantalla completa">'+icon('fullscreen')+'<span>Pantalla completa</span></button></div></details><form method="post" action="/logout"><button class="sidebar-logout" type="submit"><span class="icon">'+icon('logout')+'</span><span>Cerrar sesión</span></button></form>';
setupTheme(sessionActions.querySelector('.sidebar-tool-list'));
const navToggle=document.querySelector('#nav-toggle');
const closeMobileNav=()=>{document.body.classList.remove('mobile-nav-open');navToggle.setAttribute('aria-expanded','false');};
navToggle.onclick=()=>{if(matchMedia('(max-width:900px)').matches){const open=document.body.classList.toggle('mobile-nav-open');navToggle.setAttribute('aria-expanded',String(open));}else document.body.classList.toggle('nav-collapsed');};
document.querySelector('#navigation').addEventListener('click',closeMobileNav);
document.addEventListener('click',event=>{if(document.body.classList.contains('mobile-nav-open')&&!event.target.closest('.sidebar,#nav-toggle'))closeMobileNav();});
let previousHash=location.hash||'#home',returning=false;const visited=[];
window.addEventListener('hashchange',()=>{closeMobileNav();if(!returning)visited.push(previousHash);returning=false;previousHash=location.hash;});
document.querySelector('#back-button').onclick=()=>{const target=visited.pop()||'#home';returning=true;location.hash=target;};
const fullscreenButton=document.querySelector('#fullscreen-toggle');
fullscreenButton.onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen({navigationUI:'hide'});else await document.exitFullscreen();}catch{fullscreenButton.title='El navegador no permite pantalla completa en esta vista';}};
document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);fullscreenButton.setAttribute('aria-pressed',String(active));fullscreenButton.setAttribute('aria-label',active?'Salir de pantalla completa':'Activar pantalla completa');fullscreenButton.innerHTML=icon(active?'fullscreenExit':'fullscreen')+`<span class="control-label">${active?'':'Pantalla completa'}</span>`;window.dispatchEvent(new Event('resize'));});
document.addEventListener('click',event=>{if(event.target.closest('[data-notifications]')){event.preventDefault();const trigger=event.target.closest('[data-notifications]'),item=assets().find(i=>i.id===trigger.dataset.notificationEquipment);if(item&&!item.alarms.length)openEquipment(item);else openNotifications(trigger.dataset.notificationEquipment);return;}const card=event.target.closest('.equipment-card, .fuel-bar-row, .compact-alert, [data-quick]');if(!card||event.ctrlKey||event.metaKey)return;const id=card.dataset.quick||decodeURIComponent(card.hash?.split('/')[1]||'');const item=fleet?.equipment.find(i=>i.id===id);if(item){event.preventDefault();openEquipment(item);}});

document.addEventListener('keydown',event=>{const badge=event.target.closest('[data-notifications][role="button"]');if(badge&&['Enter',' '].includes(event.key)){event.preventDefault();badge.click();}});
refresh();
