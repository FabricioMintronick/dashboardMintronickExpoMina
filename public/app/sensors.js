import {escape as e,date} from './format.js';

const cards={
  encoder:{type:'ENCODER',title:'Ángulo',unit:'°',image:'/assets/sensors/encoder.png',alt:'Encoder industrial'},
  distance:{type:'SENSOR LINEAL',title:'Distancia',unit:'mm',image:'/assets/sensors/sensor-lineal.png',alt:'Sensor lineal industrial'}
};

function mechanism(key,value){
  const number=Number(value?.value);
  if(key==='encoder'){
    const angle=Number.isFinite(number)?Math.max(-180,Math.min(180,number)):0;
    return `<svg class="sensor-mechanism encoder-mechanism" viewBox="0 0 240 150" role="img" aria-label="Viga giratoria controlada por encoder"><path class="motion-path" d="M40 112 A78 78 0 0 1 189 76"/><path class="ticks" d="M44 107l-8 7M61 77l-10-4M91 55l-2-11M127 54l3-11M160 70l8-8M181 97l11-3"/><g class="beam" style="--angle:${angle}deg"><rect x="101" y="66" width="111" height="22" rx="8"/><path d="M194 64h27v26h-27z"/><circle cx="205" cy="77" r="5"/></g><circle class="housing" cx="101" cy="77" r="31"/><circle class="shaft" cx="101" cy="77" r="13"/><circle class="hub" cx="101" cy="77" r="5"/><text x="18" y="139">POSICIÓN ANGULAR</text></svg>`;
  }
  const ratio=Number.isFinite(number)?Math.max(0,Math.min(1,number/1000)):.15,scale=.2+ratio*.8,travel=-95+ratio*95;
  return `<svg class="sensor-mechanism linear-mechanism" viewBox="0 0 240 150" role="img" aria-label="Cable extensible del sensor lineal"><path class="rail" d="M26 112H218"/><path class="ticks" d="M35 106v12M72 108v8M109 106v12M146 108v8M183 106v12M218 108v8"/><rect class="reel-body" x="18" y="43" width="70" height="58" rx="10"/><circle class="reel" cx="54" cy="72" r="22"/><circle class="hub" cx="54" cy="72" r="7"/><path class="cable" style="--scale:${scale}" d="M54 50a22 22 0 0 1 22 22h110"/><g class="target" style="--travel:${travel}px"><rect x="178" y="48" width="35" height="49" rx="5"/><circle cx="195" cy="72" r="5"/></g><text x="18" y="139">DESPLAZAMIENTO LINEAL</text></svg>`;
}

function reading(key,value){
  const spec=cards[key],quality=value?.quality||'missing';
  return `<article class="sensor-device ${quality}"><header><div><span>SENSOR</span><h3>${spec.type}</h3>${value?.sensorId?`<small>${e(value.sensorId)}</small>`:''}</div><b>${quality==='fresh'?'EN TIEMPO REAL':quality==='stale'?'SIN SEÑAL RECIENTE':'ESPERANDO DATOS'}</b></header><div class="sensor-picture ${key}"><img src="${spec.image}" alt="${spec.alt}">${mechanism(key,value)}</div><div class="sensor-data"><span>${spec.title.toUpperCase()}</span><div><strong>${value?Number(value.value).toLocaleString('es-PE',{maximumFractionDigits:2}):'—'}</strong><em>${e(value?.unit||spec.unit)}</em></div><p>${value?.at?'Actualizado '+e(date(value.at)):'La lectura aparecerá automáticamente'}</p></div></article>`;
}

export async function mount(page,{getJSON}){
  let alive=true,timer;
  page.innerHTML=`<section class="sensor-console"><header class="sensor-toolbar"><div><span class="eyebrow">MONITOREO EN VIVO</span><h2>Encoder y sensor lineal</h2><p>Ángulo y distancia actualizados automáticamente.</p></div><div class="live-indicator"><i></i><span><b>DATOS EN TIEMPO REAL</b><small>Actualización automática</small></span></div></header><div id="sensor-content" class="sensor-content"></div></section>`;
  const content=page.querySelector('#sensor-content');
  function draw(data){
    const gateway=(data.gateways||[])[0],values=gateway?.variables||{},online=Object.values(values).some(value=>value.quality==='fresh');
    content.innerHTML=`<div class="sensor-status"><div><i class="${online?'online':''}"></i><span><b>${online?'Sensores conectados':gateway?'Sin señal reciente':'Esperando conexión'}</b><small>${gateway?e(gateway.gateway):'Las lecturas aparecerán automáticamente'}</small></span></div>${gateway?.latestAt?`<small>Actualizado ${e(date(gateway.latestAt))}</small>`:''}</div>${reading('encoder',values.encoder)}${reading('distance',values.distance)}`;
  }
  async function refresh(){
    try{draw(await getJSON('/api/sensors/latest'));}
    catch{content.innerHTML=`<div class="sensor-status"><div><i></i><span><b>Sin conexión con los sensores</b><small>Se reintentará automáticamente</small></span></div></div>${reading('encoder')}${reading('distance')}`;}
    if(alive)timer=setTimeout(refresh,2000);
  }
  draw({gateways:[]});
  refresh();
  return()=>{alive=false;clearTimeout(timer);};
}
