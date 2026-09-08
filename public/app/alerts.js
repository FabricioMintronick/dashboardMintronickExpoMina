import {machineImage} from './machine.js';
import {escape as e,date,age} from './format.js';
import {icon,observeAlarms} from './ui.js';
import {fleetAnalytics} from './analytics.js';
import {alarmSymbol} from './attention-cards.js';
import {alarmGuidance} from './alarm-guidance.js';
let mode='fresh';const reviewed=new Set();
const alarmSignature=items=>items.flatMap(i=>i.alarms.map(a=>`${i.id}:${a.code}:${a.quality}:${a.at}`)).sort().join('|');
export async function mount(page,{items,panel,getJSON}){
  let alive=true,current=items,lastSignature='';
  page.innerHTML=`<div class="alert-summary" id="alert-summary"></div><section class="alert-assets"><div><span class="eyebrow">EQUIPOS AFECTADOS</span><h2>Prioridad de revisión</h2></div><div id="alert-assets"></div></section><div class="toolbar"><label>Mostrar<select id="alert-filter"><option value="all">Todos los avisos</option><option value="fresh">Vigentes</option><option value="stale">Previos</option></select></label><button class="button secondary" id="alert-export">↓ Descargar CSV</button></div><div id="alert-grid" class="incident-grid"></div><details class="data-notes"><summary>ⓘ Qué significa revisar un aviso</summary><p>“Revisada” solo marca la lectura en esta sesión del navegador. No resuelve la condición ni crea una orden. Los avisos se supervisan automáticamente y no sustituyen un sistema certificado de seguridad.</p></details>`;
  function draw(force=false){const signature=mode+'|'+current.flatMap(i=>i.alarms.map(a=>`${i.id}:${a.code}:${a.quality}:${a.at}`)).sort().join('|')+'|'+[...reviewed].sort().join('|');if(!force&&signature===lastSignature)return;lastSignature=signature;
    const all=current.flatMap(i=>i.alarms.map(a=>({i,a})));
    page.querySelector('#alert-summary').innerHTML=[['Vigentes',all.filter(r=>r.a.quality==='fresh').length,'red'],['Previos',all.filter(r=>r.a.quality!=='fresh').length,'amber'],['Equipos afectados',new Set(all.map(r=>r.i.id)).size,'teal']].map(([label,n,color])=>`<div class="summary-tile ${color}">${icon('alerts')}<strong>${n}</strong><span>${label}</span></div>`).join('');
    const rows=all.filter(r=>mode==='all'||(mode==='fresh'?r.a.quality==='fresh':r.a.quality!=='fresh'));
    const affected=current.filter(i=>i.alarms.some(a=>a.quality==='fresh')).sort((a,b)=>b.alarms.filter(x=>x.quality==='fresh').length-a.alarms.filter(x=>x.quality==='fresh').length);
    page.querySelector('#alert-assets').innerHTML=affected.map(i=>`<button data-quick="${e(i.id)}">${machineImage(i)}<span><b>${e(i.name)}</b></span><strong>${i.alarms.filter(a=>a.quality==='fresh').length}</strong></button>`).join('')||'<span class="empty">Sin alarmas vigentes</span>';
    page.querySelector('#alert-grid').innerHTML=rows.map(({i,a})=>{const key=i.id+':'+a.code,g=alarmGuidance(a.code,a.label),current=a.quality==='fresh';return `<article class="incident ${current?'current':'old'}"><div class="incident-heading"><b>${current?'VIGENTE':'LECTURA ANTERIOR'}</b><small>${reviewed.has(key)?'Revisada en esta sesión':'Pendiente de revisión'}</small></div><div class="incident-visual">${alarmSymbol(a.code)}</div><h2>${e(g[0])}</h2><h3>${e(i.name)}</h3><div class="incident-meta"><span>Detectada: ${e(date(a.at))}</span><code>${e(a.code)}</code></div><p class="incident-reason"><b>Acción sugerida:</b> ${e(g[1])}</p><div class="quick-actions"><button class="button" data-notifications data-notification-equipment="${e(i.id)}">Ver detalle</button><button class="button secondary icon-review" data-review="${e(key)}">${reviewed.has(key)?'✓ Revisada':'Marcar revisada'}</button></div></article>`;}).join('')||'<div class="empty">No hay avisos con este filtro.</div>';
    page.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviewed.add(b.dataset.review);draw(true);});
  }
  page.querySelector('#alert-filter').value=mode;page.querySelector('#alert-filter').onchange=event=>{mode=event.target.value;draw(true);};draw(true);
  page.querySelector('#alert-export').onclick=()=>{const rows=[['Equipo','Modelo','Aviso','Código','Fecha','Vigencia'],...current.flatMap(i=>i.alarms.map(a=>[i.name,i.model,a.label,a.code,a.at,a.quality==='fresh'?'Vigente':'Lectura anterior']))],csv=rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));link.download=`MINTRONICK_avisos_${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
  const charts=fleetAnalytics(page,current,true);
  const stop=()=>{alive=false;charts();};stop.update=next=>{const changed=alarmSignature(next)!==alarmSignature(current);current=next;if(!changed)return;charts.update(next);draw();};return stop;
}
