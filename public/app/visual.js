import { overviewCards, stateOverview } from './overview-graphics.js';
import { fleetAnalytics } from './analytics.js';
import { icon } from './ui.js';
import { escape as e, number, date, age, quality, state } from './format.js';
import { getJSON } from './api.js';
import { operationalStateIndex, stateDefinitions } from './home-insights.js';
import {readingGapPlugin,seriesWithGaps} from './chart-gaps.js';

const colors = { teal: '#1a9a9b', yellow: '#fecc16', dark: '#171b1c', gray: '#b8c4c5', red: '#ca5146' };
let chosenEquipment = null, chosenSignal = 'rpm', chosenHours = 1;
let fleetScroll = 0;
const historyCache = new Map();
const trendSignals = { rpm:'RPM del motor', coolant:'Refrigerante', fuel:'Combustible', speed:'Velocidad GPS', hydtemp:'Temperatura hidráulica', voltage:'Batería', load:'Carga del motor', fuelrate:'Consumo instantáneo' };
const safePercent = value => Math.min(100, Math.max(0, Number(value) || 0));
const route = item => `#equipment/${encodeURIComponent(item.id)}`;
const machineImage = '<img class="machine-image" src="/tractor-d8-transparent.png" alt="Icono de tractor de orugas" loading="lazy">';

export function equipmentCards(items) {
  if (!items.length) return '<div class="empty">No hay equipos con estos filtros.</div>';
  return `<div class="equipment-cards">${items.map(item => {
    const fuel = item.metrics.fuel, hours = item.metrics.hours;
    const stateId=operationalStateIndex(item),stateIcon=['▶','◌','■','⊘','?'][stateId],stateLabel=stateDefinitions[stateId][1];
    const currentAlarm=item.alarms.some(alarm=>alarm.quality==='fresh');
    return `<a class="equipment-card" href="${route(item)}"><div class="machine-card-top"><span class="model-tag">${e(item.model)}</span><span class="signal-dot ${item.communication==='fresh'?'online':'offline'}" title="${item.communication==='fresh'?'Enviando datos':'Sin comunicación'}"></span></div>${machineImage}<div class="machine-card-title"><h3>${e(item.name)}</h3>${item.alarms.length ? `<span data-notifications data-notification-equipment="${e(item.id)}" class="alarm-count ${currentAlarm?'current':'historical'}" role="button" tabindex="0" title="${currentAlarm?'Alarma vigente':'Alarma registrada anteriormente'} · Abrir detalle" aria-label="${item.alarms.length} ${item.alarms.length===1?'alarma':'alarmas'} ${currentAlarm?'vigentes':'registradas anteriormente'} en ${e(item.name)}"><span class="alarm-glyph">${icon('alerts')}</span><b>${item.alarms.length}</b></span>` : ''}</div><div class="card-status-row"><span title="${e(stateDefinitions[stateId][2])}"><b>${stateIcon}</b> ${e(stateLabel)}</span><small>${item.state?.since?`Desde ${e(new Date(item.state.since).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}))}`:""}</small></div><div class="machine-metrics"><div><small>◷ Horómetro</small><strong>${number(hours.value)} <em>h</em></strong></div><div><small>⛽ Combustible</small><strong>${number(fuel.value)} <em>%</em></strong></div></div><div class="fuel-track" title="Nivel de combustible · ${e(date(fuel.at))}"><span style="width:${fuel.value===null?0:safePercent(fuel.value)}%;background:${fuel.quality==='fresh'?colors.teal:colors.gray}"></span></div></a>`;
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
export function trendHTML(items, selected) {
  return `<section class="panel trend-panel"><div class="panel-head"><div><h2 id="trend-title">Tendencia reciente de ${e(trendSignals[chosenSignal])} · ${e(selected?.name||'Equipo')}</h2></div><div class="range-switch" role="group" aria-label="Periodo de tendencia">${[1,6,24].map(h=>`<button data-hours="${h}" class="${chosenHours===h?'selected':''}">${h} h</button>`).join('')}</div></div><div class="trend-controls"><label><span class="sr-only">Equipo para tendencia</span><select id="trend-equipment">${items.map(i=>`<option value="${e(i.id)}" ${i.id===selected?.id?'selected':''}>${e(i.name)}</option>`).join('')}</select></label><label><span class="sr-only">Señal de tendencia</span><select id="trend-signal">${Object.entries(trendSignals).map(([key,label])=>`<option value="${key}" ${key===chosenSignal?'selected':''}>${label}</option>`).join('')}</select></label><a id="trend-link" class="pill-link" href="#history/${encodeURIComponent(selected?.id||'')}">Explorar ↗</a></div><div class="trend-plot"><canvas id="overview-trend" role="img" aria-label="Tendencia reciente de la señal seleccionada"></canvas><div id="trend-message" class="plot-message">Cargando lecturas…</div></div><div class="trend-summary" id="trend-summary"><span>Consultando datos de origen</span></div></section>`;
}
export function mountTrend(page, items) {
  let alive=true, chart=null, sequence=0;
  async function draw(){
    const serial=++sequence;
    chosenEquipment=page.querySelector('#trend-equipment').value;
    chosenSignal=page.querySelector('#trend-signal').value;
    const item=items.find(i=>i.id===chosenEquipment);
    const message=page.querySelector('#trend-message');
    if(!item){message.textContent='Sin equipos disponibles';return;}
    const currentMetric=item.metrics[chosenSignal];
    page.querySelector('#trend-title').textContent=`Tendencia reciente de ${trendSignals[chosenSignal]} · ${item.name}`;
    page.querySelector('#trend-link').href=`#history/${encodeURIComponent(item.id)}`;
    const timestamp=item.metrics[chosenSignal]?.at || item.lastAt || new Date().toISOString();
    const end=Math.min(Date.now(),new Date(timestamp).getTime())+1000;
    const key=`${item.id}:${chosenSignal}:${chosenHours}:${Math.floor(end/5000)}`;
    message.hidden=Boolean(chart);message.textContent='Cargando lecturas…';
    try {
      let data=historyCache.get(key);
      if(!data){data=await getJSON('/api/telemetry/history?'+new URLSearchParams({gateway:item.gateway,signal:chosenSignal,from:new Date(end-chosenHours*3600000).toISOString(),to:new Date(end).toISOString()}));if(historyCache.size>20)historyCache.clear();historyCache.set(key,data);}
      if(!alive||serial!==sequence)return;
      const valid=data.points.filter(p=>p.v!==null&&Number.isFinite(p.v));
      const summary=page.querySelector('#trend-summary');
      summary.innerHTML=`<span>${chosenSignal==='fuel'?'Nivel del tanque · ':chosenSignal==='rpm'?'Revoluciones por minuto · ':''}${data.truncated?'Muestreo limitado; reduce el periodo':`${data.points.length} muestras recibidas`}</span>`;
      if(!window.Chart){message.textContent='Gráfico no disponible. Abre Historial para consultar la tabla.';return;}
      const {series:points,gaps}=seriesWithGaps(data.points,end-chosenHours*3600000,end,data.gapAfterMs);
      if(gaps.length)summary.firstElementChild.insertAdjacentHTML('beforeend',` · ${gaps.length} ${gaps.length===1?'intervalo':'intervalos'} sin lectura registrada`);
      const latest=valid.at(-1);
      summary.innerHTML+=latest?`<strong>${number(latest.v)} <small>${e(data.unit)}</small></strong>`:'<strong>Sin muestras</strong>';
      message.hidden=true;
      if(chart){chart.data.datasets[0].data=points;chart.data.datasets[0].label=`${data.label} (${data.unit})`;chart.options.plugins.readingGaps.ranges=gaps;chart.options.scales.x.min=end-chosenHours*3600000;chart.options.scales.x.max=end;chart.options.scales.y.title.text=data.unit;chart.update('none');return;}
      chart=new Chart(page.querySelector('#overview-trend'),{type:'line',plugins:[readingGapPlugin],data:{datasets:[{label:`${data.label} (${data.unit})`,data:points,borderColor:colors.teal,backgroundColor:'rgba(26,154,155,.10)',fill:true,borderWidth:2,pointRadius:points.length>100?0:2,pointHoverRadius:5,spanGaps:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,interaction:{intersect:false,mode:'nearest'},plugins:{readingGaps:{ranges:gaps},legend:{display:false},tooltip:{backgroundColor:'#141a1b',callbacks:{title:ctx=>date(ctx[0].parsed.x)}}},scales:{x:{type:'linear',min:end-chosenHours*3600000,max:end,grid:{display:false},ticks:{maxTicksLimit:6,color:'#839194',callback:t=>new Date(t).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}},y:{title:{display:true,text:data.unit,color:'#839194'},grid:{color:'#eef2f2'},ticks:{maxTicksLimit:5,color:'#839194'}}}}});
    }catch(err){if(alive&&serial===sequence){chart?.destroy();chart=null;message.textContent='No se pudo cargar la tendencia. Cambia el periodo o vuelve a intentar.';}}
  }
  page.querySelector('#trend-equipment').addEventListener('change',draw);
  page.querySelector('#trend-signal').addEventListener('change',draw);
  page.querySelectorAll('[data-hours]').forEach(button=>button.addEventListener('click',()=>{chosenHours=Number(button.dataset.hours);page.querySelectorAll('[data-hours]').forEach(b=>b.classList.toggle('selected',b===button));draw();}));
  draw();const stop=()=>{alive=false;sequence++;chart?.destroy();};stop.update=next=>{items=next;if(!page.querySelector('#trend-equipment'))return;const selected=items.find(i=>i.id===page.querySelector('#trend-equipment').value);const timestamp=selected?.metrics[chosenSignal]?.at;if(timestamp!==stop.lastAt||selected?.metrics[chosenSignal]?.quality!==stop.lastQuality){stop.lastAt=timestamp;stop.lastQuality=selected?.metrics[chosenSignal]?.quality;draw();}};return stop;
}

export function homeView(page, { items, fleet, panel }) {
  const recent=items.filter(i=>i.communication==='fresh').length;
  const gps=items.filter(i=>i.location?.quality==='fresh').length;
  const alarms=items.filter(i=>i.alarms.length);
  const selected=items.find(i=>i.id===chosenEquipment)||items.find(i=>i.communication==='fresh'&&i.metrics.rpm.value!==null)||items[0];
  const fuelItems=items.filter(i=>i.metrics.fuel.value!==null).sort((a,b)=>(b.metrics.fuel.quality==='fresh')-(a.metrics.fuel.quality==='fresh')||a.metrics.fuel.value-b.metrics.fuel.value);
  page.innerHTML=`${overviewCards(items)}
  <div class="overview-charts">${panel('¿Qué están reportando los equipos?','Cada fila permite abrir ese grupo.',stateOverview(items),'<a class="pill-link" href="#equipment">↗</a>')}${trendHTML(items,selected)}</div>
  <div class="fleet-section-heading"><div><span class="eyebrow">EXPLORAR LA FLOTA</span><h2>Equipos en monitoreo</h2><p class="chart-caption">${items.length} equipos · Desliza para ver todos · Orden por nombre, no por criticidad.</p></div><div class="fleet-paging"><button class="button secondary" data-scroll="-1" aria-label="Equipos anteriores">←</button><button class="button secondary" data-scroll="1" aria-label="Equipos siguientes">→</button><a class="button secondary" href="#equipment">Ver todos</a></div></div>
  <div class="home-fleet-scroll">${equipmentCards([...items].sort((a,b)=>a.name.localeCompare(b.name)))}</div>
  <div class="bottom-charts">${panel('Nivel de combustible','% del tanque · Menor nivel primero dentro de cada vigencia',`<div class="fuel-comparison">${fuelItems.map(i=>`<a class="fuel-bar-row" href="${route(i)}"><strong>${e(i.name)}</strong><div><div class="fuel-track"><span style="width:${safePercent(i.metrics.fuel.value)}%;background:${i.metrics.fuel.quality==='fresh'?colors.teal:colors.gray}"></span></div><small>${e(age(i.metrics.fuel.at))}</small></div><b>${number(i.metrics.fuel.value)}<small>%</small></b></a>`).join('')||'<div class="empty">No hay niveles de combustible disponibles.</div>'}</div>`)}${panel('Alarmas reportadas',`${alarms.length} equipos · Última evidencia recibida`, `<div class="compact-alerts">${alarms.map(i=>`<a class="compact-alert" href="${route(i)}"><span class="alert-symbol ${i.alarmQuality==='fresh'?'current':''}">△</span><div><strong>${e(i.name)}</strong><p>${e(i.alarms[0].label)}${i.alarms.length>1?` +${i.alarms.length-1}`:''}</p></div><small>${e(age(i.alarms[0].at))}<br>${i.alarmQuality==='fresh'?'Reciente':'Sin confirmar'}</small><span>↗</span></a>`).join('')||'<div class="empty">Sin alarmas en las últimas lecturas disponibles.</div>'}</div>`, '<a class="pill-link" href="#alerts">Ver todas →</a>')}</div>
  <details class="data-notes"><summary>ⓘ Criterios de lectura y colores</summary><p>Turquesa: datos recientes o series medidas. Amarillo: énfasis de marca y estado de ralentí, no gravedad. Gris: datos atrasados o sin estado vigente. Rojo: alarma de origen reciente. Las barras representan nivel, no consumo. Vigencia provisional: ${fleet.staleAfterSeconds} s. Ningún color confirma salud mecánica.</p></details>`;
  const strip=page.querySelector('.home-fleet-scroll');strip.scrollLeft=fleetScroll;strip.addEventListener('scroll',()=>{fleetScroll=strip.scrollLeft;});
  page.querySelectorAll('[data-scroll]').forEach(button=>button.onclick=()=>strip.scrollBy({left:Number(button.dataset.scroll)*strip.clientWidth*.8,behavior:'smooth'}));
  const trend=mountTrend(page,items),analytics=fleetAnalytics(page,items);
  const stop=()=>{trend();analytics();};stop.update=next=>{trend.update(next);analytics.update(next);const cards=page.querySelector('.graphic-kpis');if(cards){const template=document.createElement('div');template.innerHTML=overviewCards(next);cards.replaceWith(template.firstElementChild);}const states=page.querySelector('.state-explainer');if(states){const temp=document.createElement('div');temp.innerHTML=stateOverview(next);states.replaceWith(temp.firstElementChild);}const strip=page.querySelector('.home-fleet-scroll');const scroll=strip.scrollLeft;strip.innerHTML=equipmentCards([...next].sort((a,b)=>a.name.localeCompare(b.name)));strip.scrollLeft=scroll;page.querySelectorAll('.fuel-bar-row').forEach(row=>{const i=next.find(x=>row.hash===route(x));if(!i)return;row.querySelector('.fuel-track span').style.width=safePercent(i.metrics.fuel.value)+'%';row.querySelector('.fuel-track span').style.background=i.metrics.fuel.quality==='fresh'?colors.teal:colors.gray;row.querySelector('b').textContent=number(i.metrics.fuel.value)+'%';row.querySelector('small').textContent=age(i.metrics.fuel.at);});const alerts=page.querySelector('.compact-alerts');alerts.innerHTML=next.filter(i=>i.alarms.length).map(i=>'<a class="compact-alert" href="'+route(i)+'"><span class="alert-symbol">△</span><div><strong>'+e(i.name)+'</strong><p>'+e(i.alarms.map(a=>a.label).join(' · '))+'</p></div><small>'+e(age(i.alarms[0].at))+'</small></a>').join('')||'<div class="empty">Sin alarmas reportadas en la última lectura.</div>';};return stop;
}

function dial(metric, max, label) {
  if(metric.quality!=='fresh'||!Number.isFinite(metric.value))return '';
  const value=metric.value,pct=safePercent(value/max*100);
  return `<article class="dial-card"><small>${e(label)}</small><div class="gauge-ring" style="--percent:${pct}%;--gauge-color:${colors.teal}" role="img" aria-label="${e(label)} actual: ${number(value)} ${e(metric.unit)}"><div><strong>${number(value)}</strong><span>${e(metric.unit)}</span></div></div><span class="dial-info" title="Escala visual 0–${max}; no es límite de seguridad">ⓘ</span></article>`;
}
const accumulatedKeys=['fuelrate','fuelTotal','idleHours','idleFuel'];
function accumulatedHTML(item){const anyFresh=accumulatedKeys.some(key=>item.metrics[key]?.quality==='fresh'&&Number.isFinite(item.metrics[key]?.value));return `<section class="panel accumulated-panel" ${anyFresh?'':'hidden'}><div class="panel-head"><div><h2>Consumos y acumulados</h2><p>Evolución durante la última hora con lectura vigente</p></div></div><div class="accumulated-chart-grid">${accumulatedKeys.map(key=>{const m=item.metrics[key],fresh=m?.quality==='fresh'&&Number.isFinite(m.value);return `<article data-accumulated="${key}" ${fresh?'':'hidden'}><header><span>${e(m.label)}</span><strong>${number(m.value)} <small>${e(m.unit)}</small></strong></header><div class="accumulated-plot"><canvas role="img" aria-label="Tendencia reciente de ${e(m.label)}"></canvas><span>Cargando…</span></div></article>`;}).join('')}</div></section>`;}
function mountAccumulatedCharts(root,item){let alive=true,revision=0,charts=new Map(),lastSignature='';async function update(current){if(!root)return;const signature=accumulatedKeys.map(k=>`${current.metrics[k]?.at||''}:${current.metrics[k]?.quality}`).join('|');if(signature===lastSignature)return;lastSignature=signature;const serial=++revision,end=new Date(),from=new Date(end-3600000),freshKeys=accumulatedKeys.filter(key=>current.metrics[key]?.quality==='fresh'&&Number.isFinite(current.metrics[key]?.value));root.hidden=!freshKeys.length;for(const key of accumulatedKeys){const card=root.querySelector(`[data-accumulated="${key}"]`);card.hidden=!freshKeys.includes(key);if(card.hidden){charts.get(key)?.destroy();charts.delete(key);}}await Promise.all(freshKeys.map(async key=>{const card=root.querySelector(`[data-accumulated="${key}"]`),metric=current.metrics[key],message=card.querySelector('.accumulated-plot span');card.querySelector('header strong').innerHTML=`${number(metric.value)} <small>${e(metric.unit)}</small>`;try{const data=await getJSON('/api/telemetry/history?'+new URLSearchParams({gateway:current.gateway,signal:key,from:from.toISOString(),to:end.toISOString()}));if(!alive||serial!==revision)return;const points=data.points.filter(p=>Number.isFinite(p.v)).map(p=>({x:new Date(p.t).getTime(),y:p.v}));if(!points.length){card.hidden=true;if(!root.querySelector('[data-accumulated]:not([hidden])'))root.hidden=true;charts.get(key)?.destroy();charts.delete(key);return;}message.hidden=true;const dataset={data:points,borderColor:key==='fuelrate'?'#e3ad2e':'#159c9c',backgroundColor:key==='fuelrate'?'#e3ad2e20':'#159c9c18',fill:true,borderWidth:2,pointRadius:0,tension:.15};const existing=charts.get(key);if(existing){existing.data.datasets[0]=dataset;existing.update('none');return;}charts.set(key,new Chart(card.querySelector('canvas'),{type:'line',data:{datasets:[dataset]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>date(c[0].parsed.x)}}},scales:{x:{type:'linear',display:false},y:{display:false}}}}));}catch{card.hidden=true;if(!root.querySelector('[data-accumulated]:not([hidden])'))root.hidden=true;}}));}update(item);const stop=()=>{alive=false;revision++;charts.forEach(c=>c.destroy());charts.clear();};stop.update=update;return stop;}
export function detailView(page,{item,panel}) {
  page.innerHTML=`<div class="asset-hero compact-hero"><div class="asset-identity"><h2>${e(item.name)}</h2><p>${e(item.model)}</p><div>${state(item)} ${quality(item.communication)}</div><div class="asset-actions"><a class="button" href="#map/${encodeURIComponent(item.id)}">⌖ Ver ubicación</a></div></div><div class="hero-machine">${machineImage}</div><div class="hero-hours"><small>HORÓMETRO</small><strong>${number(item.metrics.hours.value)} <em>h</em></strong><button class="hero-alarm" data-notifications data-notification-equipment="${e(item.id)}">${item.alarms.length} banderas de alarma ↗</button></div></div>
  <div class="dial-grid">${dial(item.metrics.rpm,3000,'RPM del motor')}${dial(item.metrics.coolant,120,'Refrigerante')}${dial(item.metrics.fuel,100,'Combustible')}${dial(item.metrics.load,100,'Carga del motor')}</div>
  ${trendHTML([item],item)}
  <div class="dial-grid secondary-dials">${dial(item.metrics.speed,25,'Velocidad GPS')}${dial(item.metrics.voltage,32,'Batería')}${dial(item.metrics.hydtemp,120,'Temperatura hidráulica')}</div>
  ${accumulatedHTML(item)}
  ${item.alarms.some(a=>a.quality==='fresh')?`<div class="notice warning" id="detail-alarm-notice">△ ${item.alarms.filter(a=>a.quality==='fresh').map(a=>e(a.label)).join(' · ')} · Reportadas por el equipo</div>`:'<div class="notice warning" id="detail-alarm-notice" hidden></div>'}
  <details class="data-notes"><summary>ⓘ Sobre las escalas</summary><p>Los medidores muestran magnitud y solo aparecen con una lectura vigente. Los límites de seguridad deben validarse por modelo.</p></details>`;
  const trend=mountTrend(page,[item]),accumulated=mountAccumulatedCharts(page.querySelector('.accumulated-panel'),item);
  const behavior=document.createElement('details');behavior.className='equipment-behavior panel';behavior.innerHTML='<summary>Comportamiento de la última hora <span>4 gráficos</span></summary><div class="bottom-charts" id="equipment-statistics"></div>';page.querySelector('.trend-panel').after(behavior);const extra=behavior.querySelector('#equipment-statistics');
  let alive=true,revision=0,lastRequest=0;
  async function statistics(current){if(Date.now()-lastRequest<30000)return;lastRequest=Date.now();const serial=++revision;const end=new Date(current.lastAt||Date.now());const from=new Date(end-3600000);try{const module=await import('./signal-statistics.js');if(alive&&serial===revision)await module.show(extra,current,from,end,()=>alive&&serial===revision);}catch{if(alive)extra.textContent='No se pudieron consultar las estadísticas.';}}
  statistics(item);
  const stop=()=>{alive=false;revision++;trend();accumulated();extra.dispatchEvent(new Event('dispose'));};stop.update=next=>{const current=next.find(i=>i.id===item.id);if(!current)return;trend.update([current]);accumulated.update(current);const dials=page.querySelector('.dial-grid:not(.secondary-dials)');dials.innerHTML=dial(current.metrics.rpm,3000,'RPM del motor')+dial(current.metrics.coolant,120,'Refrigerante')+dial(current.metrics.fuel,100,'Combustible')+dial(current.metrics.load,100,'Carga del motor');page.querySelector('.secondary-dials').innerHTML=dial(current.metrics.speed,25,'Velocidad GPS')+dial(current.metrics.voltage,32,'Batería')+dial(current.metrics.hydtemp,120,'Temperatura hidráulica');const hours=page.querySelector('.hero-hours strong');hours.innerHTML=number(current.metrics.hours.value)+' <em>h</em>';page.querySelector('.hero-alarm').textContent=current.alarms.length+' banderas de alarma ↗';page.querySelector('.asset-identity>div').innerHTML=state(current)+' '+quality(current.communication);const currentAlarms=current.alarms.filter(a=>a.quality==='fresh'),alarmNotice=page.querySelector('#detail-alarm-notice');alarmNotice.hidden=!currentAlarms.length;alarmNotice.innerHTML=currentAlarms.length?'△ '+currentAlarms.map(a=>e(a.label)).join(' · ')+' · Reportadas por el equipo':'';statistics(current);};return stop;
}
