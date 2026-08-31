import { icon } from './ui.js';
import { escape as e, number, date, age, quality, state } from './format.js';
import { getJSON } from './api.js';

const colors = { teal: '#1a9a9b', yellow: '#fecc16', dark: '#171b1c', gray: '#b8c4c5', red: '#ca5146' };
let chosenEquipment = null, chosenSignal = 'rpm', chosenHours = 1;
let fleetScroll = 0;
const historyCache = new Map();
const trendSignals = { rpm:'RPM del motor', coolant:'Refrigerante', speed:'Velocidad GPS', fuel:'Combustible' };
const safePercent = value => Math.min(100, Math.max(0, Number(value) || 0));
const route = item => `#equipment/${encodeURIComponent(item.id)}`;
const machineImage = '<img class="machine-image" src="/tractor-d8.png" alt="Icono de tractor de orugas" loading="lazy">';

export function equipmentCards(items) {
  if (!items.length) return '<div class="empty">No hay equipos con estos filtros.</div>';
  return `<div class="equipment-cards">${items.map(item => {
    const fuel = item.metrics.fuel, hours = item.metrics.hours;
    return `<a class="equipment-card" href="${route(item)}"><div class="machine-card-top"><span class="model-tag">${e(item.model)}</span><span class="signal-dot ${item.communication==='fresh'?'online':'offline'}" title="${item.communication==='fresh'?'Comunicación reciente':'Sin comunicación reciente'}"></span></div>${machineImage}<div class="machine-card-title"><h3>${e(item.name)}</h3><span>${item.alarms.length ? `<span class="alarm-count" title="Alarmas en la última lectura, incluidas atrasadas">△ ${item.alarms.length}</span>` : '↗'}</span></div><div class="machine-state">${state(item)}</div><div class="machine-metrics"><div><small>Horómetro</small><strong>${number(hours.value)} <em>h</em></strong></div><div><small>Combustible</small><strong>${number(fuel.value)} <em>%</em></strong></div></div><div class="fuel-track" title="Nivel de combustible · ${e(date(fuel.at))}"><span style="width:${fuel.value===null?0:safePercent(fuel.value)}%;background:${fuel.quality==='fresh'?colors.teal:colors.gray}"></span></div><div class="card-foot"><span>${e(age(item.lastAt))}</span><span>${fuel.quality==='fresh'?'Nivel reciente':'Nivel sin vigencia'}</span></div></a>`;
  }).join('')}</div>`;
}

export function donut(items) {
  const groups = [
    {label:'Duty',color:colors.teal,count:0}, {label:'Ralentí',color:colors.yellow,count:0},
    {label:'Contacto',color:'#8bbebb',count:0}, {label:'Apagado',color:'#465052',count:0},
    {label:'Sin estado vigente',color:'#dce3e3',count:0}
  ];
  for(const item of items){const key=String(item.state.value||'').toLowerCase();const index=item.state.quality==='fresh'?['duty','idle','keyon','off'].indexOf(key):-1;groups[index<0?4:index].count++;}
  let total=0;const stops=groups.map(g=>{const start=total;total+=items.length?g.count/items.length*100:0;return `${g.color} ${start}% ${total}%`;});
  return `<div class="donut-block"><div class="fleet-donut" style="background:conic-gradient(${items.length?stops.join(','):'#dce3e3 0% 100%'})" role="img" aria-label="${e(groups.map(g=>`${g.label}: ${g.count}`).join(', '))}"><div><strong>${items.length}</strong><span>EQUIPOS</span></div></div><div class="donut-legend">${groups.map(g=>`<div><span><i style="background:${g.color}"></i>${g.label}</span><strong>${g.count} <small>(${number(items.length?g.count/items.length*100:0)}%)</small></strong></div>`).join('')}</div></div><p class="chart-caption">% = equipos del estado ÷ flota total. No es productividad.</p>`;
}
function trendHTML(items, selected) {
  return `<section class="panel trend-panel"><div class="panel-head"><div><span class="eyebrow">TELEMETRÍA</span><h2>Tendencia del equipo</h2></div><div class="range-switch" role="group" aria-label="Periodo de tendencia">${[1,6,24].map(h=>`<button data-hours="${h}" class="${chosenHours===h?'selected':''}">${h} h</button>`).join('')}</div></div><div class="trend-controls"><label><span class="sr-only">Equipo para tendencia</span><select id="trend-equipment">${items.map(i=>`<option value="${e(i.id)}" ${i.id===selected?.id?'selected':''}>${e(i.name)}</option>`).join('')}</select></label><label><span class="sr-only">Señal de tendencia</span><select id="trend-signal">${Object.entries(trendSignals).map(([key,label])=>`<option value="${key}" ${key===chosenSignal?'selected':''}>${label}</option>`).join('')}</select></label><a id="trend-link" class="pill-link" href="#history/${encodeURIComponent(selected?.id||'')}">Explorar ↗</a></div><div class="trend-plot"><canvas id="overview-trend" role="img" aria-label="Historial de la señal seleccionada"></canvas><div id="trend-message" class="plot-message">Cargando lecturas…</div></div><div class="trend-summary" id="trend-summary"><span>Consultando datos de origen</span></div></section>`;
}
function mountTrend(page, items) {
  let alive=true, chart=null, sequence=0;
  async function draw(){
    const serial=++sequence;
    chosenEquipment=page.querySelector('#trend-equipment').value;
    chosenSignal=page.querySelector('#trend-signal').value;
    const item=items.find(i=>i.id===chosenEquipment);
    const message=page.querySelector('#trend-message');
    if(!item){message.textContent='Sin equipos disponibles';return;}
    page.querySelector('#trend-link').href=`#history/${encodeURIComponent(item.id)}`;
    const timestamp=item.metrics[chosenSignal]?.at || item.lastAt;
    if(!timestamp){message.textContent='Sin lecturas para esta señal';chart?.destroy();chart=null;return;}
    const end=Math.min(Date.now(),new Date(timestamp).getTime())+1000;
    const key=`${item.id}:${chosenSignal}:${chosenHours}:${Math.floor(end/60000)}`;
    message.hidden=false;message.textContent='Cargando lecturas…';
    try {
      let data=historyCache.get(key);
      if(!data){data=await getJSON('/api/telemetry/history?'+new URLSearchParams({gateway:item.gateway,signal:chosenSignal,from:new Date(end-chosenHours*3600000).toISOString(),to:new Date(end).toISOString()}));if(historyCache.size>20)historyCache.clear();historyCache.set(key,data);}
      if(!alive||serial!==sequence)return;
      chart?.destroy();chart=null;
      const valid=data.points.filter(p=>p.v!==null&&Number.isFinite(p.v));
      const summary=page.querySelector('#trend-summary');
      summary.innerHTML=`<span>${e(new Date(data.from).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))} → ${e(new Date(data.to).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}))}</span><span>${chosenSignal==='fuel'?'% = nivel del tanque · ':chosenSignal==='rpm'?'rpm = revoluciones/min · ':''}${data.truncated?'⚠ 5 000 puntos · Acorta el rango':`${data.points.length} muestras`}</span>`;
      if(!valid.length){message.textContent='Sin lecturas en este periodo';return;}
      if(!window.Chart){message.textContent='Gráfico no disponible. Abre Historial para consultar la tabla.';return;}
      const points=[];let previous=null;
      for(const p of data.points){const time=new Date(p.t).getTime();if(previous!==null&&time-previous>data.gapAfterMs*1.5)points.push({x:previous+1,y:null});points.push({x:time,y:p.v});previous=time;}
      const latest=valid.at(-1);
      summary.innerHTML+=`<strong>${number(latest.v)} <small>${e(data.unit)}</small></strong>`;
      message.hidden=true;
      chart=new Chart(page.querySelector('#overview-trend'),{type:'line',data:{datasets:[{label:`${data.label} (${data.unit})`,data:points,borderColor:colors.teal,backgroundColor:'rgba(26,154,155,.10)',fill:true,borderWidth:2,pointRadius:points.length>100?0:2,pointHoverRadius:5,spanGaps:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,interaction:{intersect:false,mode:'nearest'},plugins:{legend:{display:false},tooltip:{backgroundColor:'#141a1b',callbacks:{title:ctx=>date(ctx[0].parsed.x)}}},scales:{x:{type:'linear',min:end-chosenHours*3600000,max:end,grid:{display:false},ticks:{maxTicksLimit:6,color:'#839194',font:{size:10},callback:t=>new Date(t).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}},y:{title:{display:true,text:data.unit,color:'#839194'},grid:{color:'#eef2f2'},ticks:{maxTicksLimit:5,color:'#839194',font:{size:10}}}}}});
    }catch(err){if(alive&&serial===sequence){chart?.destroy();chart=null;message.textContent='No se pudo cargar la tendencia. Cambia el periodo o vuelve a intentar.';}}
  }
  page.querySelector('#trend-equipment').addEventListener('change',draw);
  page.querySelector('#trend-signal').addEventListener('change',draw);
  page.querySelectorAll('[data-hours]').forEach(button=>button.addEventListener('click',()=>{chosenHours=Number(button.dataset.hours);page.querySelectorAll('[data-hours]').forEach(b=>b.classList.toggle('selected',b===button));draw();}));
  draw();return ()=>{alive=false;sequence++;chart?.destroy();};
}

export function homeView(page, { items, fleet, panel }) {
  const recent=items.filter(i=>i.communication==='fresh').length;
  const gps=items.filter(i=>i.location?.quality==='fresh').length;
  const alarms=items.filter(i=>i.alarms.length);
  const selected=items.find(i=>i.id===chosenEquipment)||items.find(i=>i.communication==='fresh'&&i.metrics.rpm.value!==null)||items[0];
  const stat=(label,value,note,cls,glyph)=>`<a href="${({fleet:'#equipment',connected:'#equipment?filter=fresh',alerts:'#alerts',gps:'#map?filter=fresh'})[cls]}" class="visual-kpi ${cls}"><span class="visual-kpi-icon">${icon(({fleet:'equipment',connected:'signal',alerts:'alerts',gps:'gps'})[cls])}</span><div><small>${label}</small><strong>${value}</strong><p>${note}</p></div><span class="kpi-arrow">↗</span></a>`;
  const fuelItems=items.filter(i=>i.metrics.fuel.value!==null).sort((a,b)=>(b.metrics.fuel.quality==='fresh')-(a.metrics.fuel.quality==='fresh')||a.metrics.fuel.value-b.metrics.fuel.value);
  page.innerHTML=`<div class="visual-kpis">${stat('Flota registrada',items.length,'Equipos de operación','fleet','▦')}${stat('Comunicación reciente',recent,`${items.length-recent} sin datos recientes`,'connected','↗')}${stat('Última lectura con alarma',alarms.length,'Incluye lecturas atrasadas','alerts','△')}${stat('GPS reciente',gps,'Posiciones actualizadas','gps','⌖')}</div>
  <div class="overview-charts">${panel('Estado de la flota','Equipos por estado vigente',donut(items),'<a class="pill-link" href="#equipment">↗</a>')}${trendHTML(items,selected)}</div>
  <div class="fleet-section-heading"><div><span class="eyebrow">EXPLORAR LA FLOTA</span><h2>Equipos en monitoreo</h2><p class="chart-caption">${items.length} equipos · Desliza para ver todos · Orden por nombre, no por criticidad.</p></div><div class="fleet-paging"><button class="button secondary" data-scroll="-1" aria-label="Equipos anteriores">←</button><button class="button secondary" data-scroll="1" aria-label="Equipos siguientes">→</button><a class="button secondary" href="#equipment">Ver todos</a></div></div>
  <div class="home-fleet-scroll">${equipmentCards([...items].sort((a,b)=>a.name.localeCompare(b.name)))}</div>
  <div class="bottom-charts">${panel('Nivel de combustible','% del tanque · Menor nivel primero dentro de cada vigencia',`<div class="fuel-comparison">${fuelItems.map(i=>`<a class="fuel-bar-row" href="${route(i)}"><strong>${e(i.name)}</strong><div><div class="fuel-track"><span style="width:${safePercent(i.metrics.fuel.value)}%;background:${i.metrics.fuel.quality==='fresh'?colors.teal:colors.gray}"></span></div><small>${e(age(i.metrics.fuel.at))}</small></div><b>${number(i.metrics.fuel.value)}<small>%</small></b></a>`).join('')||'<div class="empty">No hay niveles de combustible disponibles.</div>'}</div>`)}${panel('Alarmas reportadas',`${alarms.length} equipos · Última evidencia recibida`, `<div class="compact-alerts">${alarms.map(i=>`<a class="compact-alert" href="${route(i)}"><span class="alert-symbol ${i.alarmQuality==='fresh'?'current':''}">△</span><div><strong>${e(i.name)}</strong><p>${e(i.alarms[0].label)}${i.alarms.length>1?` +${i.alarms.length-1}`:''}</p></div><small>${e(age(i.alarms[0].at))}<br>${i.alarmQuality==='fresh'?'Reciente':'Sin confirmar'}</small><span>↗</span></a>`).join('')||'<div class="empty">Sin alarmas en las últimas lecturas disponibles.</div>'}</div>`, '<a class="pill-link" href="#alerts">Ver todas →</a>')}</div>
  <details class="data-notes"><summary>ⓘ Criterios de lectura y colores</summary><p>Turquesa: datos recientes o series medidas. Amarillo: énfasis de marca y estado de ralentí, no gravedad. Gris: datos atrasados o sin estado vigente. Rojo: alarma de origen reciente. Las barras representan nivel, no consumo. Vigencia provisional: ${fleet.staleAfterSeconds} s. Ningún color confirma salud mecánica.</p></details>`;
  const strip=page.querySelector('.home-fleet-scroll');strip.scrollLeft=fleetScroll;strip.addEventListener('scroll',()=>{fleetScroll=strip.scrollLeft;});
  page.querySelectorAll('[data-scroll]').forEach(button=>button.onclick=()=>strip.scrollBy({left:Number(button.dataset.scroll)*strip.clientWidth*.8,behavior:'smooth'}));
  return mountTrend(page,items);
}

function dial(metric, max, label) {
  const pct=metric.value===null?0:safePercent(metric.value/max*100),color=metric.quality==='fresh'?colors.teal:colors.gray;
  return `<article class="dial-card"><small>${e(label)}</small><div class="gauge-ring" style="--percent:${pct}%;--gauge-color:${color}" role="img" aria-label="${e(label)}: ${number(metric.value)} ${e(metric.unit)}"><div><strong>${number(metric.value)}</strong><span>${e(metric.unit)}</span></div></div>${quality(metric.quality)}<p>${e(age(metric.at))}</p><small class="scale-label">Escala visual 0–${max} · No es límite</small></article>`;
}
export function detailView(page,{item,panel}) {
  page.innerHTML=`<div class="asset-hero"><div class="asset-identity"><span class="eyebrow">MONITOREO INDIVIDUAL</span><h2>${e(item.name)}</h2><p>${e(item.model)} · ${e(item.gateway)}</p><div>${state(item)} ${quality(item.communication)}</div><div class="asset-actions"><a class="button" href="#map/${encodeURIComponent(item.id)}">⌖ Ver ubicación</a><a class="button secondary" href="#history/${encodeURIComponent(item.id)}">◷ Historial</a></div></div><div class="hero-machine">${machineImage}</div><div class="hero-hours"><small>HORÓMETRO</small><strong>${number(item.metrics.hours.value)} <em>h</em></strong><span>${e(age(item.metrics.hours.at))}</span><div class="hero-alarm">△ ${item.alarms.length} alarmas en última lectura</div></div></div>
  <div class="dial-grid">${dial(item.metrics.rpm,3000,'RPM del motor')}${dial(item.metrics.coolant,120,'Refrigerante')}${dial(item.metrics.fuel,100,'Combustible')}${dial(item.metrics.load,100,'Carga del motor')}</div>
  ${trendHTML([item],item)}
  ${panel('Señales complementarias','Lecturas de origen',`<div class="compact-signals">${['speed','voltage','hydtemp','fuelrate','fuelTotal','idleHours','idleFuel'].map(key=>{const m=item.metrics[key];return `<div><small>${e(m.label)}</small><strong>${number(m.value)} <em>${e(m.unit)}</em></strong>${quality(m.quality)}<span title="${e(date(m.at))}">${e(age(m.at))}</span></div>`;}).join('')}</div>`)}
  ${item.alarms.length?`<div class="notice warning">△ ${item.alarms.map(a=>e(a.label)).join(' · ')} · ${item.alarmQuality==='fresh'?'Reportadas por el equipo':'Evidencia atrasada; no confirma resolución'}</div>`:''}
  <details class="data-notes"><summary>ⓘ Sobre las escalas y los datos</summary><p>Los medidores muestran magnitud, no umbrales de seguridad. Los valores atrasados permanecen grises con su fecha. Se deben validar límites por modelo antes de colorear una desviación como crítica.</p></details>`;
  return mountTrend(page,[item]);
}
