import {escape as e,date} from './format.js';

const cards={
  encoder:{type:'ENCODER',title:'Ángulo',unit:'°',image:'/assets/sensors/encoder.png',alt:'Encoder industrial'},
  distance:{type:'SENSOR LINEAL',title:'Distancia',unit:'mm',image:'/assets/sensors/sensor-lineal.png',alt:'Sensor lineal industrial'}
};

function mechanism(key,value){
  const number=Number(value?.value);
  if(key==='encoder'){
    const angle=Number.isFinite(number)?Math.max(-180,Math.min(180,number)):0;
    return `<div class="sensor-mechanism encoder-mechanism" aria-label="Representación del ángulo"><i></i><b style="--angle:${angle}deg"></b><small>GIRO</small></div>`;
  }
  const extension=Number.isFinite(number)?Math.max(12,Math.min(100,number/10)):25;
  return `<div class="sensor-mechanism linear-mechanism" aria-label="Representación de la extensión"><i></i><b style="--extension:${extension}%"></b><small>EXTENSIÓN</small></div>`;
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
