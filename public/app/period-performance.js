import {escape as e,date,number} from './format.js';
import {pool} from './signals.js';

const counterSignals=['hours','fuelTotal','idleHours','idleFuel'];
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

export function counterDelta(data){
  let points=(data?.points||[]).filter(point=>finite(point.v));
  if(!points.length)return {value:null,reason:'El equipo no transmitió este contador en el periodo'};
  if(points.length<2)return {value:null,reason:'Falta una segunda lectura para calcular la diferencia'};
  if(data.bucketMs)return {value:null,reason:'El periodo fue resumido y no conserva extremos exactos'};
  const ordered=[...points].sort((a,b)=>Number(a.v)-Number(b.v)),range=Number(ordered.at(-1).v)-Number(ordered[0].v);
  let split=-1,largestGap=0;
  for(let index=1;index<ordered.length;index++){const gap=Number(ordered[index].v)-Number(ordered[index-1].v);if(gap>largestGap){largestGap=gap;split=index;}}
  if(split>0&&largestGap>Math.max(1,range*.5)){
    const threshold=(Number(ordered[split-1].v)+Number(ordered[split].v))/2,groups=points.map(point=>Number(point.v)>threshold),transitions=groups.slice(1).reduce((count,upper,index)=>count+(upper!==groups[index]?1:0),0);
    if(transitions>=2)points=points.filter(point=>Number(point.v)>threshold);
  }
  if(points.length<2)return {value:null,reason:'No hay dos lecturas coherentes del mismo contador'};
  for(let index=1;index<points.length;index++)if(Number(points[index].v)+.001<Number(points[index-1].v))return {value:null,reason:'El contador disminuyó o fue reiniciado'};
  const value=Number(points.at(-1).v)-Number(points[0].v);
  return value>=0?{value,from:points[0].t,to:points.at(-1).t}:{value:null,reason:'Contador no válido'};
}

export function performanceFrom(series){
  const hours=counterDelta(series.hours),fuel=counterDelta(series.fuelTotal),idleHours=counterDelta(series.idleHours),idleFuel=counterDelta(series.idleFuel);
  const worked=hours.value,litres=fuel.value,idle=idleHours.value,idleLitres=idleFuel.value;
  const timeValid=finite(worked)&&finite(idle)&&worked>0&&idle>=0&&idle<=worked;
  const fuelValid=finite(litres)&&finite(idleLitres)&&litres>=0&&idleLitres>=0&&idleLitres<=litres;
  return {hours,fuel,idleHours,idleFuel,worked,litres,idle,idleLitres,
    average:finite(worked)&&worked>0&&finite(litres)?litres/worked:null,
    utilization:timeValid?(worked-idle)/worked*100:null,
    operatingHours:timeValid?worked-idle:null,
    operatingFuel:fuelValid?litres-idleLitres:null,
    idleTimePercent:timeValid?idle/worked*100:null,
    idleFuelPercent:fuelValid&&litres>0?idleLitres/litres*100:null};
}

const value=(amount,unit,digits=1)=>finite(amount)?`${number(Number(amount).toFixed(digits))} <small>${unit}</small>`:'—';
const tile=(label,amount,unit,help)=>`<article><span>${e(label)}</span><strong>${value(amount,unit)}</strong><small>${e(help)}</small></article>`;
const bar=(label,primary,secondary,primaryLabel,secondaryLabel,unit)=>{
  const total=Number(primary)+Number(secondary),valid=finite(primary)&&finite(secondary)&&total>0,pct=valid?Math.max(0,Math.min(100,Number(primary)/total*100)):0;
  return `<div class="performance-bar"><header><b>${e(label)}</b><span>${valid?`${number(primary)} ${e(unit)} / ${number(secondary)} ${e(unit)}`:'Información insuficiente'}</span></header><div role="img" aria-label="${e(label)}"><i style="width:${pct}%"></i><i style="width:${valid?100-pct:0}%"></i></div><footer><span>${e(primaryLabel)}</span><span>${e(secondaryLabel)}</span></footer></div>`;
};

export function mountPeriodPerformance(root,{gateway,from,to,getJSON,controls=false}={}){
  let alive=true,revision=0,current={gateway,from,to};
  root.classList.add('period-performance');
  async function update(next={}){
    current={...current,...next};const serial=++revision;
    root.innerHTML=`<div class="panel-head"><div><h2>Rendimiento del periodo</h2><p>${e(date(current.from))} → ${e(date(current.to))}</p></div>${controls?'<div class="performance-periods"><button type="button" data-hours="8">8 h</button><button type="button" data-hours="12">12 h</button><button type="button" class="selected" data-hours="24">24 h</button></div>':''}</div><div class="empty">Calculando contadores del periodo…</div>`;
    if(controls)root.querySelectorAll('[data-hours]').forEach(button=>button.onclick=()=>{root.querySelectorAll('[data-hours]').forEach(item=>item.classList.toggle('selected',item===button));const end=new Date(current.to),start=new Date(end-Number(button.dataset.hours)*3600000);update({from:start.toISOString()});});
    try{
      const results=await pool(counterSignals,key=>getJSON('/api/telemetry/history?'+new URLSearchParams({gateway:current.gateway,signal:key,from:new Date(current.from).toISOString(),to:new Date(current.to).toISOString()})),2);
      if(!alive||serial!==revision)return;
      const summary=performanceFrom(Object.fromEntries(counterSignals.map((key,index)=>[key,results[index]])));
      const missing=[['Horas',summary.hours],['Combustible',summary.fuel],['Ralentí',summary.idleHours],['Combustible en ralentí',summary.idleFuel]].filter(([,result])=>result.value===null),coverage=[summary.hours,summary.fuel,summary.idleHours,summary.idleFuel].filter(result=>result.value!==null&&result.from&&result.to);
      root.innerHTML=`<div class="panel-head"><div><h2>Rendimiento del periodo</h2><p>${e(date(current.from))} → ${e(date(current.to))}</p></div>${controls?'<div class="performance-periods"><button type="button" data-hours="8">8 h</button><button type="button" data-hours="12">12 h</button><button type="button" data-hours="24">24 h</button></div>':''}</div><div class="performance-tiles">${tile('Horas trabajadas',summary.worked,'h','Aumento del horómetro')}${tile('Combustible consumido',summary.litres,'L','Aumento del contador total')}${tile('Consumo promedio',summary.average,'L/h','Litros por hora trabajada')}${tile('Tiempo en ralentí',summary.idle,'h','Motor encendido en ralentí')}${tile('Combustible en ralentí',summary.idleLitres,'L','Consumo durante ralentí')}${tile('Utilización operativa',summary.utilization,'%','Tiempo trabajado fuera de ralentí')}</div><div class="performance-bars">${bar('Distribución del tiempo',summary.operatingHours,summary.idle,'Operación','Ralentí','h')}${bar('Distribución del combustible',summary.operatingFuel,summary.idleLitres,'Operación','Ralentí','L')}</div>${missing.length?`<p class="performance-warning">Información insuficiente: ${missing.map(([label,result])=>`${e(label)} (${e(result.reason)})`).join(' · ')}</p>`:`<p class="performance-note">Calculado con diferencias de contadores acumulados. Lecturas utilizadas entre ${e(date(coverage.map(item=>item.from).sort()[0]))} y ${e(date(coverage.map(item=>item.to).sort().at(-1)))}. “Operativa” significa tiempo fuera de ralentí; no confirma producción física.</p>`}`;
      if(controls)root.querySelectorAll('[data-hours]').forEach(button=>{const selected=Math.round((new Date(current.to)-new Date(current.from))/3600000)===Number(button.dataset.hours);button.classList.toggle('selected',selected);button.onclick=()=>{const end=new Date(current.to);update({from:new Date(end-Number(button.dataset.hours)*3600000).toISOString()});};});
    }catch(error){if(alive&&serial===revision)root.innerHTML=`<div class="panel-head"><h2>Rendimiento del periodo</h2></div><div class="empty">${e(error.message)}</div>`;}
  }
  update();
  const stop=()=>{alive=false;revision++;};stop.update=update;return stop;
}
