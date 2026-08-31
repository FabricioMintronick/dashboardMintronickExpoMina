import { icon, openEquipment, toggleSound, observeAlarms } from './ui.js';
import { homeView, detailView, equipmentCards } from './visual.js';
import { getJSON } from './api.js';
import { escape as e, number, date, age, badge, quality, state, condition } from './format.js';
const routes = {
  home: ['⌂','Inicio','Resumen de flota','Supervisión de tu flota y telemetría.'],
  equipment: ['▦','Equipos','Tus equipos','Selecciona un equipo para explorar su telemetría.'],
  map: ['⌖','Mapa GPS','Ubicación de la flota','Tu flota en el terreno.'],
  alerts: ['△','Alertas','Alarmas reportadas','Última evidencia recibida de los equipos.'],
  history: ['◷','Historial','Explorar el historial','Consulta una señal y un periodo. Los vacíos se muestran como falta de información.'],
  reports: ['▤','Reportes','Reporte de situación','Exporta una fotografía de la flota con valores, fechas y calidad del dato.'],
  maintenance: ['⚒','Mantenimiento','Planificación de mantenimiento','Horómetros disponibles y requisitos para activar planes preventivos.']
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
function home() { cleanup = homeView(page, { items: assets(), fleet, panel }); }
function equipment() {
  let cards = true;
  page.innerHTML = `<div class="toolbar"><label class="grow">Buscar equipo<input id="search" type="search" placeholder="Nombre, modelo o gateway…"></label><label>Comunicación<select id="filter"><option value="all">Todos los equipos</option><option value="fresh">Con datos recientes</option><option value="old">Sin datos recientes</option><option value="alarm">Con alarma en última lectura</option></select></label><label class="check"><input id="tests" type="checkbox"> Incluir pruebas</label></div><div class="fleet-section-heading"><h2>Directorio de equipos</h2><button class="button secondary" id="toggle-equipment-view">Ver lista</button></div><div id="equipment-table"></div>`;
  const draw = () => {
    const query = document.querySelector('#search').value.toLowerCase(), filter = document.querySelector('#filter').value;
    const stateFilter = new URLSearchParams(location.hash.split('?')[1]).get('state');
    const items = fleet.equipment.filter(i => (!i.test || document.querySelector('#tests').checked) && `${i.name} ${i.model} ${i.gateway}`.toLowerCase().includes(query) && (!stateFilter || (stateFilter==='unknown' ? i.state.quality!=='fresh' : i.state.quality==='fresh' && String(i.state.value).toLowerCase()===stateFilter)) && (filter === 'all' || filter === 'fresh' && i.communication === 'fresh' || filter === 'old' && i.communication !== 'fresh' || filter === 'alarm' && i.alarms.length));
    document.querySelector('#equipment-table').innerHTML = cards ? equipmentCards(items) : '<section class="panel">'+equipmentTable(items)+'</section>';
  };
  document.querySelector('#toggle-equipment-view').addEventListener('click',event=>{cards=!cards;event.target.textContent=cards?'Ver lista':'Ver tarjetas';draw();});
  document.querySelector('#filter').value=new URLSearchParams(location.hash.split('?')[1]).get('filter')||'all';
  ['search','filter','tests'].forEach(id => document.getElementById(id).addEventListener('input',draw)); draw();
}
function detail(id) {
  const item=fleet.equipment.find(i=>i.id===id);
  if(!item){page.innerHTML='<div class="empty">Equipo no encontrado. <a href="#equipment">Volver</a></div>';return;}
  document.querySelector('#page-title').textContent=item.name;
  document.querySelector('#page-description').textContent='Estado y telemetría del equipo';
  cleanup=detailView(page,{item,panel});
}
async function render() {
  document.querySelector('#back-button').hidden=selection().route==='home';
  cleanup(); cleanup = () => {}; const version = ++routeVersion;
  const { route, id } = selection();
  document.querySelector('#page-title').textContent = routes[route][2];
  document.querySelector('#page-description').textContent = routes[route][3];
  document.querySelector('#breadcrumb').textContent = `Operaciones / ${routes[route][1]}`;
  if(fleet && !error) document.querySelector('#connection').textContent = `${date(fleet.generatedAt)} · ${route==='home'||route==='alerts'||route==='equipment'&&id ? 'Actualiza cada 15 s' : 'Vista a demanda · Avisos activos'}`;
  document.querySelectorAll('[data-route]').forEach(a => {a.classList.toggle('active',a.dataset.route === route); if(a.dataset.route === route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if (!fleet || error) { page.innerHTML = `<div class="error-box"><h2>${busy ? 'Preparando la información de tu flota' : 'No pudimos consultar los datos'}</h2><p>${e(error || 'La interfaz está conectando con la API. No se muestran equipos simulados.')}</p>${busy ? '' : '<button class="button secondary" id="retry">Reintentar consulta</button>'}</div>`; document.querySelector('#retry')?.addEventListener('click',()=>refresh(false)); return; }
  if(route==='home')home(); else if(route==='equipment') id ? detail(id) : equipment(); 
  else {
    page.innerHTML = '<div class="empty">Preparando vista…</div>';
    try {
      const module = await import(`./${route==='map'?'map-explorer':route==='history'?'compare-history':route==='reports'?'report-explorer':route}.js`);
      if(version !== routeVersion)return;
      cleanup = await module.mount(page, { fleet, items:assets(), id, panel, equipmentTable, getJSON }) || (()=>{});
    } catch(err) { if(version===routeVersion)page.innerHTML=`<div class="error-box"><h2>No se pudo abrir esta vista</h2><p>${e(err.message)}</p></div>`; }
  }
  compactExplanations();
}
async function refresh(background = false) {
  if(busy)return; busy=true;
  document.querySelector('#refresh').disabled=true;
  const status=document.querySelector('#connection'), previousStatus=status.textContent; if(!background)status.textContent='Consultando la fuente de datos…';
  if(!fleet)render();
  try {fleet=await getJSON('/api/fleet');observeAlarms(fleet.equipment.filter(i=>!i.test));error=null;status.className='connection ok';status.textContent=`Consulta completada · ${date(fleet.generatedAt)} · Vigencia provisional: ${fleet.staleAfterSeconds} s · Actualización manual`;}
  catch(err){error=err.message;status.className='connection error';status.textContent='Fuente no disponible · No se puede confirmar el estado de la flota';}
  finally{busy=false;document.querySelector('#refresh').disabled=false;const r=selection();if(!background||r.route==='home'||r.route==='equipment'&&r.id)render();else if(!error)status.textContent=previousStatus;}
}
window.addEventListener('hashchange',render);
document.querySelector('#refresh').addEventListener('click',()=>refresh(false));
setInterval(()=>{if(!document.hidden)refresh(true);},15000);


const topbar=document.querySelector('.topbar');
topbar.insertAdjacentHTML('afterbegin','<div class="nav-actions"><button id="nav-toggle" class="icon-button" aria-label="Contraer menú">'+icon('menu')+'</button><button id="back-button" class="icon-button" aria-label="Regresar">'+icon('back')+'<span>Regresar</span></button></div>');
topbar.querySelector('div:last-child').insertAdjacentHTML('afterbegin','<a class="icon-button" href="#alerts" aria-label="Abrir alarmas">'+icon('bell')+'<b id="bell-count">0</b></a><button id="sound-toggle" class="button secondary" aria-pressed="false">Activar sonido</button>');
document.querySelector('#nav-toggle').onclick=()=>document.body.classList.toggle('nav-collapsed');
let previousHash=location.hash||'#home',returning=false;const visited=[];
window.addEventListener('hashchange',()=>{if(!returning)visited.push(previousHash);returning=false;previousHash=location.hash;});
document.querySelector('#back-button').onclick=()=>{const target=visited.pop()||'#home';returning=true;location.hash=target;};
document.querySelector('#sound-toggle').onclick=event=>{const on=toggleSound();event.currentTarget.textContent=on?'Sonido activo':'Activar sonido';event.currentTarget.setAttribute('aria-pressed',String(on));};
document.addEventListener('click',event=>{const card=event.target.closest('.equipment-card, .fuel-bar-row, .compact-alert, [data-quick]');if(!card||event.ctrlKey||event.metaKey)return;const id=card.dataset.quick||decodeURIComponent(card.hash?.split('/')[1]||'');const item=fleet?.equipment.find(i=>i.id===id);if(item){event.preventDefault();openEquipment(item);}});

refresh();
