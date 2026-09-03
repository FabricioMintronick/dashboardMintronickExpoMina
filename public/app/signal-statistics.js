import {getJSON} from './api.js';
import {chartPanel,liveChart} from './analytics.js';
import {date,number} from './format.js';
export async function show(root,item,from,to,active=()=>true){
const definitions=[['rpm','Lecturas de RPM del motor por rango'],['coolant','Lecturas de temperatura del refrigerante por rango'],['fuel','Lecturas de nivel de combustible por rango'],['hydtemp','Lecturas de temperatura hidráulica por rango']];
 root.hidden=false;
 const signature=definitions.map(([signal])=>signal).join('|');
 if(root.statisticsSignature!==signature){root.statisticsCharts?.forEach(c=>c.destroy());root.statisticsCharts=null;root.innerHTML='';root.statisticsSignature=signature;}
 const results=await Promise.all(definitions.map(([signal])=>getJSON('/api/telemetry/history?'+new URLSearchParams({gateway:item.gateway,signal,from:from.toISOString(),to:to.toISOString()}))));
 if(!active())return;
 if(!root.statisticsCharts){root.innerHTML=results.map((r,i)=>chartPanel(definitions[i][1],`${date(from)} → ${date(to)} · Rangos en ${r.unit}`,'stat-'+i)).join('');root.statisticsCharts=results.map((_,i)=>liveChart(root,'stat-'+i,'bar',null,{xTitle:'Cantidad de lecturas',tooltipPrefix:'Lecturas'}));root.addEventListener('dispose',()=>{root.statisticsCharts?.forEach(c=>c.destroy());root.statisticsCharts=null;},{once:true});}
 const charts=results.map((r,i)=>{
 root.querySelectorAll('.panel-head p')[i].textContent=`${date(from)} → ${date(to)} · Rangos en ${r.unit}`;
 const valid=r.points.map(p=>p.v).filter(Number.isFinite);const c=root.statisticsCharts[i];
 if(!valid.length){c.update(['Sin muestras registradas'],[0],['#66747a']);root.querySelector('#stat-'+i+'-legend').textContent='No se recibieron muestras de esta señal durante el periodo consultado.';return c;}
 const min=Math.min(...valid),max=Math.max(...valid),step=(max-min||1)/5;
 const bins=Array(5).fill(0);valid.forEach(v=>bins[Math.min(4,Math.floor((v-min)/step))]++);
 c.update(bins.map((_,n)=>`${number(min+n*step)}–${number(min+(n+1)*step)} ${r.unit}`),bins,[i===1?'#e3ad2e':'#159c9c']);
 root.querySelector('#stat-'+i+'-legend').textContent=`${valid.length} lecturas · Mín. ${number(min)} ${r.unit} · Prom. ${number(valid.reduce((a,b)=>a+b,0)/valid.length)} ${r.unit} · Máx. ${number(max)} ${r.unit}${r.truncated?' · Consulta parcial':''}`;
 return c;
 });
}
