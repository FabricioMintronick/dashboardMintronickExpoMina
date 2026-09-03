import {escape as e,date,number} from './format.js';
import {signals,pool} from './signals.js';
import {readingGapPlugin,seriesWithGaps} from './chart-gaps.js';
import {mountPeriodPerformance} from './period-performance.js';

const primarySignals=['rpm','coolant','fuel','hydtemp'];
const local=time=>{const d=new Date(time);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const panelTemplate=key=>`<section class="panel history-signal-panel" id="compare-${key}" data-signal="${key}"><div class="panel-head"><h2>${e(signals[key][0])}</h2><span>${e(signals[key][1])}</span></div><div class="empty">Consultando…</div></section>`;

export async function mount(page,{items,id,getJSON}){
  let alive=true,periodLabel='1 hora';
  const charts=new Map(),requests=new Map(),cache=new Map();
  const item=items.find(i=>i.id===id)||items.find(i=>i.communication==='fresh')||items[0];
  const end=Math.min(Date.now(),new Date(item?.lastAt||Date.now()).getTime());
  const picker=keys=>keys.map(key=>{const [name,unit,color]=signals[key];return `<label><input type="checkbox" value="${key}" ${primarySignals.includes(key)?'checked':''}><i style="background:${color}"></i><span>${e(name)}</span><small>${e(unit)}</small></label>`;}).join('');
  const secondary=Object.keys(signals).filter(key=>!primarySignals.includes(key));
  page.innerHTML=`<form id="compare-form"><div class="history-command wide"><label><b class="control-heading">Equipo</b><select id="compare-equipment">${items.map(i=>`<option value="${e(i.gateway)}" ${i===item?'selected':''}>${e(i.name)}</option>`).join('')}</select></label><div><b class="control-heading">Periodo</b><div class="history-presets"><button class="selected" type="button" data-period="1">1 h</button><button type="button" data-period="6">6 h</button><button type="button" data-period="24">24 h</button><button type="button" data-period="168">7 días</button><button type="button" data-period="720">30 días</button></div></div><details class="custom-range"><summary>Rango personalizado</summary><div><label>Desde<input type="datetime-local" id="compare-from" value="${local(end-3600000)}" required></label><span>→</span><label>Hasta<input type="datetime-local" id="compare-to" value="${local(end+1000)}" required></label><button type="submit" data-apply class="button">Aplicar</button></div></details></div><fieldset class="history-signals wide"><legend>Variables</legend><div class="signal-picker primary-signals">${picker(primarySignals)}</div><details class="more-signals"><summary>Más variables</summary><div class="signal-picker secondary-signals">${picker(secondary)}</div></details></fieldset></form><section class="history-range-summary" id="history-range"></section><section class="panel" id="history-performance"></section><div id="compare-result" class="compare-grid"></div>`;
  const form=page.querySelector('#compare-form'),output=page.querySelector('#compare-result'),summary=page.querySelector('#history-range');
  const selection=()=>[...form.querySelectorAll('.signal-picker input:checked')].map(input=>input.value);
  const query=()=>({gateway:page.querySelector('#compare-equipment').value,from:new Date(page.querySelector('#compare-from').value).toISOString(),to:new Date(page.querySelector('#compare-to').value).toISOString()});
  const performance=mountPeriodPerformance(page.querySelector('#history-performance'),{...query(),getJSON});
  const updateSummary=()=>{const q=query(),count=selection().length;summary.innerHTML=`<b>${e(periodLabel)}</b><span>${e(date(q.from))} → ${e(date(q.to))}</span><small>${count} ${count===1?'variable':'variables'} · Los espacios interrumpen el trazo cuando no hubo lecturas.</small>`;};
  function destroy(key){requests.set(key,(requests.get(key)||0)+1);charts.get(key)?.destroy();charts.delete(key);page.querySelector(`#compare-${key}`)?.remove();}
  function orderPanels(){for(const key of selection()){const panel=page.querySelector(`#compare-${key}`);if(panel)output.append(panel);}}
  async function loadSignal(key,{force=false}={}){
    if(!alive||!form.querySelector(`input[value="${key}"]`)?.checked)return;
    let box=page.querySelector(`#compare-${key}`);if(!box){output.insertAdjacentHTML('beforeend',panelTemplate(key));box=page.querySelector(`#compare-${key}`);orderPanels();}
    const serial=(requests.get(key)||0)+1;requests.set(key,serial);const q=query(),cacheKey=key+'|'+Object.values(q).join('|');
    box.classList.add('loading');
    try{
      let data=!force&&cache.get(cacheKey);if(!data){data=await getJSON('/api/telemetry/history?'+new URLSearchParams({...q,signal:key}));cache.set(cacheKey,data);if(cache.size>40)cache.delete(cache.keys().next().value);}
      if(!alive||serial!==requests.get(key)||!form.querySelector(`input[value="${key}"]`)?.checked)return;
      charts.get(key)?.destroy();charts.delete(key);
      const valid=data.points.filter(point=>Number.isFinite(point.v)),[label,unit,color,type]=signals[key];
      box.innerHTML=`<div class="panel-head"><h2>${e(label)}</h2><span>${e(unit)}</span><button class="button secondary" type="button" data-expand aria-label="Ampliar ${e(label)}">Ampliar ↗</button></div><div class="comparison-plot"><canvas aria-label="${e(label)}" role="img"></canvas></div><div class="comparison-stats"><span>Mín. <b>${valid.length?number(Math.min(...valid.map(p=>p.min??p.v))):'—'}</b></span><span>Máx. <b>${valid.length?number(Math.max(...valid.map(p=>p.max??p.v))):'—'}</b></span><span>${data.points.length} ${data.bucketMs?'intervalos':'lecturas'}</span></div>${data.automaticallySummarized?'<p class="chart-caption">Datos resumidos para mostrar todo el periodo.</p>':''}`;
      box.querySelector('[data-expand]').onclick=()=>{box.classList.toggle('expanded-chart');window.dispatchEvent(new Event('resize'));};
      if(!valid.length||!window.Chart){box.querySelector('.comparison-plot').innerHTML=`<div class="empty">${!valid.length?'Sin lecturas registradas':'Gráfico no disponible'}</div>`;return;}
      const {series,gaps}=seriesWithGaps(data.points,q.from,q.to,data.gapAfterMs);
      charts.set(key,new Chart(box.querySelector('canvas'),{type:'line',plugins:[readingGapPlugin],data:{datasets:[{label:`${label} (${unit})`,data:series,borderColor:color,backgroundColor:color+'18',fill:type==='area',stepped:type==='step',spanGaps:false,pointRadius:0,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{readingGaps:{ranges:gaps},legend:{display:false},tooltip:{callbacks:{title:c=>date(c[0].parsed.x)}}},scales:{x:{type:'linear',min:new Date(q.from).getTime(),max:new Date(q.to).getTime(),ticks:{maxTicksLimit:4,callback:t=>new Date(t).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})},grid:{display:false}},y:{min:unit==='%'?0:undefined,max:unit==='%'?100:undefined,title:{display:true,text:unit}}}}}));
    }catch(error){if(alive&&serial===requests.get(key)){box.innerHTML=`<div class="panel-head"><h2>${e(signals[key][0])}</h2></div><div class="empty">${e(error.message)}</div>`;}}
    finally{box?.classList.remove('loading');}
  }
  async function refreshSelection(){updateSummary();performance.update(query());const keys=selection();output.querySelectorAll('[data-signal]').forEach(panel=>{if(!keys.includes(panel.dataset.signal))destroy(panel.dataset.signal);});for(const key of keys){const box=page.querySelector(`#compare-${key}`);charts.get(key)?.destroy();charts.delete(key);if(box)box.innerHTML=`<div class="panel-head"><h2>${e(signals[key][0])}</h2><span>${e(signals[key][1])}</span></div><div class="empty">Actualizando…</div>`;}await pool(keys,key=>loadSignal(key,{force:true}),3);}
  form.addEventListener('change',event=>{if(!event.target.matches('.signal-picker input'))return;updateSummary();if(event.target.checked)loadSignal(event.target.value);else destroy(event.target.value);});
  form.onsubmit=event=>{event.preventDefault();periodLabel='Rango personalizado';refreshSelection();form.querySelector('.custom-range').open=false;};
  page.querySelector('#compare-equipment').onchange=()=>{const now=Date.now();page.querySelector('#compare-from').value=local(now-3600000);page.querySelector('#compare-to').value=local(now);periodLabel='1 hora';form.querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('selected',button.dataset.period==='1'));refreshSelection();};
  form.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>{const now=Date.now();periodLabel=button.textContent.trim();form.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('selected',x===button));page.querySelector('#compare-from').value=local(now-Number(button.dataset.period)*3600000);page.querySelector('#compare-to').value=local(now);refreshSelection();});
  updateSummary();await pool(primarySignals,key=>loadSignal(key),3);
  return ()=>{alive=false;performance();requests.forEach((value,key)=>requests.set(key,value+1));charts.forEach(chart=>chart.destroy());charts.clear();};
}
