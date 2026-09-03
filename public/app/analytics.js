import {escape as e} from './format.js';
export const palette=['#159c9c','#ffcc16','#85bdb6','#455957','#cbd6d3'];
export function chartPanel(title,subtitle,id){return `<section class="panel"><div class="panel-head"><div><h2>${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div></div><div style="height:270px;padding:20px;position:relative"><canvas id="${id}" aria-label="${e(title)}" role="img"></canvas></div><div id="${id}-legend" class="chart-caption"></div></section>`;}
export function liveChart(root,id,type,onSelect,labels={}){
 let chart;
 return {update(labels,values,colors=palette){
 const canvas=root.querySelector('#'+id);if(!canvas)return;
 root.querySelector('#'+id+'-legend').textContent=type==='bar'?'Compara la longitud de las barras. Toca una para explorar.':labels.map((x,i)=>`${x}: ${values[i]??'Sin dato'}`).join(' · ');
 if(!window.Chart)return;
 if(chart){chart.data.labels=labels;chart.data.datasets[0].data=values;chart.data.datasets[0].backgroundColor=colors;chart.update('none');return;}
 chart=new Chart(canvas,{type,data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0,borderRadius:type==='bar'?6:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:450},cutout:'72%',indexAxis:type==='bar'?'y':'x',onClick:(_,elements)=>{if(elements.length)onSelect?.(elements[0].index);},plugins:{legend:{display:type!=='bar',position:'right',labels:{usePointStyle:true,boxWidth:9}},tooltip:{callbacks:{label:c=>`${labels.tooltipPrefix||'Cantidad'}: ${c.raw??'Sin dato'}`}}},...(type==='bar'?{scales:{x:{beginAtZero:true,ticks:{precision:0},title:{display:Boolean(labels.xTitle),text:labels.xTitle||''}},y:{grid:{display:false},ticks:{autoSkip:false},title:{display:Boolean(labels.yTitle),text:labels.yTitle||''}}}}:{})}});
 },destroy(){chart?.destroy();}};
}
export function fleetAnalytics(root,items,alertsOnly=false){
 const target=document.createElement('div');target.className='bottom-charts';
 target.innerHTML=chartPanel(alertsOnly?'Vigencia de las alarmas':'Estado reportado de la flota',alertsOnly?'':'Distribución de equipos · Haz clic para explorar','live-state')+chartPanel('Alarmas por tipo',alertsOnly?'':'Incluye evidencia atrasada; no es frecuencia histórica','live-alarms');
 const kpis=root.querySelector('.graphic-kpis'),priority=root.querySelector('.alert-assets');if(priority&&alertsOnly)priority.after(target);else if(kpis)kpis.after(target);else root.prepend(target);
 const states=['duty','idle','keyon','off','unknown'];
 const a=liveChart(root,'live-state','doughnut',index=>{if(alertsOnly){const select=root.querySelector('#alert-filter');select.value=index===0?'fresh':'stale';select.dispatchEvent(new Event('change'));}else location.hash='#equipment?state='+states[index];});
 const b=liveChart(root,'live-alarms','bar',()=>{location.hash='#alerts';});
 function update(next){
 const counts=[0,0,0,0,0];for(const i of next){const index=i.state.quality==='fresh'?states.indexOf(String(i.state.value).toLowerCase()):-1;counts[index<0?4:index]++;}
 if(alertsOnly){const all=next.flatMap(i=>i.alarms),fresh=all.filter(x=>x.quality==='fresh').length;a.update(['Recientes','Anteriores'],[fresh,all.length-fresh],['#ca5146','#e3ad2e']);}else a.update(['Operando','Ralentí','Detenido','Sin conexión'],counts);
 const alarms=new Map();next.forEach(i=>i.alarms.forEach(x=>alarms.set(x.label,(alarms.get(x.label)||0)+1)));
 b.update([...alarms.keys()],[...alarms.values()],['#e3ad2e']);
 }
 update(items);const stop=()=>{a.destroy();b.destroy();};stop.update=update;return stop;
}
