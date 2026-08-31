import {escape as e,date,age} from './format.js';
import {icon,observeAlarms} from './ui.js';
let mode='all';const reviewed=new Set();
export async function mount(page,{items,panel,getJSON}){
  let alive=true,current=items;
  page.innerHTML=`<div class="alert-summary" id="alert-summary"></div><div class="toolbar"><label>Mostrar<select id="alert-filter"><option value="all">Todas las últimas alarmas</option><option value="fresh">Solo recientes</option><option value="stale">Atrasadas: verificar</option></select></label><span class="chart-caption">El sonido se activa arriba. Avisa de nuevas alarmas observadas con esta página abierta.</span></div><div id="alert-grid" class="incident-grid"></div><details class="data-notes"><summary>ⓘ Qué significa revisar una alarma</summary><p>“Revisada” solo marca la lectura en esta sesión del navegador. No resuelve la alarma ni crea una orden. Los avisos se comparan cada 15 s; no son una alarma de seguridad ni funcionan con la aplicación cerrada. No se repite el sonido por cada lectura del mismo código.</p></details>`;
  function draw(){
    const all=current.flatMap(i=>i.alarms.map(a=>({i,a})));
    page.querySelector('#alert-summary').innerHTML=[['Recientes',all.filter(r=>r.a.quality==='fresh').length,'red'],['Por verificar',all.filter(r=>r.a.quality!=='fresh').length,'amber'],['Equipos afectados',new Set(all.map(r=>r.i.id)).size,'teal']].map(([label,n,color])=>`<div class="summary-tile ${color}">${icon('alerts')}<strong>${n}</strong><span>${label}</span></div>`).join('');
    const rows=all.filter(r=>mode==='all'||(mode==='fresh'?r.a.quality==='fresh':r.a.quality!=='fresh'));
    page.querySelector('#alert-grid').innerHTML=rows.map(({i,a})=>{const key=i.id+':'+a.code;return `<article class="incident ${a.quality==='fresh'?'current':'old'}"><div class="incident-heading">${icon('alerts')}<span>${a.quality==='fresh'?'ALARMA REPORTADA':'EVIDENCIA ATRASADA'}</span><small>${e(age(a.at))}</small></div><h2>${e(a.label)}</h2><h3>${e(i.name)}</h3><p>Origen: <code>${e(a.code)}</code></p><p>${e(date(a.at))}</p><div class="incident-reason">${a.quality==='fresh'?'El equipo reporta esta condición. Revisa la señal y su contexto antes de intervenir.':'No hay confirmación vigente de la condición ni de su resolución.'}</div><div class="quick-actions"><button class="button" data-quick="${e(i.id)}">Ver evidencia</button><button class="button secondary" data-review="${e(key)}">${reviewed.has(key)?'✓ Revisada en esta sesión':'Marcar revisada'}</button></div></article>`;}).join('')||'<div class="empty">No hay alarmas con este filtro. Esto no confirma salud mecánica.</div>';
    page.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviewed.add(b.dataset.review);draw();});
  }
  page.querySelector('#alert-filter').value=mode;page.querySelector('#alert-filter').onchange=event=>{mode=event.target.value;draw();};draw();
  const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await getJSON('/api/fleet');if(!alive)return;current=next.equipment.filter(i=>!i.test);observeAlarms(current);draw();}catch{if(alive)page.querySelector('#alert-summary').setAttribute('title','No se pudo actualizar: se conserva la última consulta');}},15000);
  return ()=>{alive=false;clearInterval(timer);};
}
