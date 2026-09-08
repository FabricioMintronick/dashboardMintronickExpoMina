import {escape as e,date} from './format.js';

const cards={
  encoder:{type:'ENCODER',title:'Ángulo',unit:'°',image:'/assets/sensors/encoder.png',alt:'Encoder industrial'},
  distance:{type:'SENSOR LINEAL',title:'Distancia',unit:'mm',image:'/assets/sensors/sensor-lineal.png',alt:'Sensor lineal industrial'}
};

function mechanism(key,value,previous){
  const number=Number(value?.value);
  if(key==='encoder'){
    const angle=Number.isFinite(number)?Math.max(-180,Math.min(180,number)):0;
    const from=Number.isFinite(previous)?Math.max(-180,Math.min(180,previous)):angle;
    return `<svg class="sensor-mechanism encoder-mechanism" viewBox="0 0 300 180" role="img" aria-label="Mástil de perforadora controlado por encoder"><path class="ground" d="M18 151H284"/><g class="drill-base"><path d="M43 125h111l22 19H37z"/><rect x="52" y="111" width="82" height="28" rx="6"/><path d="M67 105l15-29h39l18 29z"/><circle cx="61" cy="143" r="12"/><circle cx="145" cy="143" r="12"/></g><path class="motion-path" d="M117 106A87 87 0 0 1 254 48"/><g class="drill-mast" style="--from-angle:${from}deg;--angle:${angle}deg"><rect x="116" y="94" width="139" height="20" rx="7"/><path d="M145 91h93v-8h11v36h-11v-8h-93z"/><path class="drill-bit" d="M252 94h25l12 10-12 10h-25z"/></g><circle class="housing" cx="116" cy="104" r="25"/><circle class="shaft" cx="116" cy="104" r="11"/><text x="20" y="173">INCLINACIÓN DEL MÁSTIL · ${angle.toFixed(1)}°</text></svg>`;
  }
  const ratio=Number.isFinite(number)?Math.max(0,Math.min(1,number/1000)):.15,fromNumber=Number(previous),fromRatio=Number.isFinite(fromNumber)?Math.max(0,Math.min(1,fromNumber/1000)):ratio;
  return `<svg class="sensor-mechanism linear-mechanism" viewBox="0 0 300 180" role="img" aria-label="Brazo telescópico de grúa controlado por sensor lineal"><path class="ground" d="M15 151H286"/><g class="crane-base"><rect x="22" y="119" width="112" height="28" rx="6"/><path d="M45 116l14-31h42l22 31z"/><circle cx="45" cy="149" r="13"/><circle cx="111" cy="149" r="13"/><circle class="pivot" cx="116" cy="113" r="12"/></g><g class="crane-boom" style="--from-scale:${(.42+fromRatio*.58).toFixed(3)};--scale:${(.42+ratio*.58).toFixed(3)}"><path class="boom-outer" d="M112 104L267 40l9 21-155 64z"/><path class="boom-inner" d="M175 82l98-41 7 17-98 41z"/><path class="cable" d="M274 54v75"/><path class="hook" d="M265 129h18c0 18-18 22-24 9"/></g><path class="measurement" d="M116 164H272"/><text x="20" y="176">EXTENSIÓN DEL BRAZO · ${Number.isFinite(number)?number.toFixed(1):'—'} mm</text></svg>`;
}

function reading(key,value,previous){
  const spec=cards[key],quality=value?.quality||'missing';
  return `<article class="sensor-device ${quality}"><header><div><span>SENSOR</span><h3>${spec.type}</h3>${value?.sensorId?`<small>${e(value.sensorId)}</small>`:''}</div><b>${quality==='fresh'?'EN TIEMPO REAL':quality==='stale'?'SIN SEÑAL RECIENTE':'ESPERANDO DATOS'}</b></header><div class="sensor-picture ${key}"><img src="${spec.image}" alt="${spec.alt}">${mechanism(key,value,previous)}</div><div class="sensor-data"><span>${spec.title.toUpperCase()}</span><div><strong>${value?Number(value.value).toLocaleString('es-PE',{maximumFractionDigits:2}):'—'}</strong><em>${e(value?.unit||spec.unit)}</em></div><p>${value?.at?'Actualizado '+e(date(value.at)):'La lectura aparecerá automáticamente'}</p></div></article>`;
}

export async function mount(page,{getJSON}){
  let alive=true,timer,previous={};
  page.innerHTML=`<section class="sensor-console"><header class="sensor-toolbar"><div><span class="eyebrow">MONITOREO EN VIVO</span><h2>Encoder y sensor lineal</h2><p>Ángulo y distancia actualizados automáticamente.</p></div><div class="live-indicator"><i></i><span><b>DATOS EN TIEMPO REAL</b><small>Actualización automática</small></span></div></header><div id="sensor-content" class="sensor-content"></div></section>`;
  const content=page.querySelector('#sensor-content');
  function draw(data){
    const gateway=(data.gateways||[])[0],values=gateway?.variables||{},online=Object.values(values).some(value=>value.quality==='fresh');
    content.innerHTML=`<div class="sensor-status"><div><i class="${online?'online':''}"></i><span><b>${online?'Sensores conectados':gateway?'Sin señal reciente':'Esperando conexión'}</b><small>${gateway?e(gateway.gateway):'Las lecturas aparecerán automáticamente'}</small></span></div>${gateway?.latestAt?`<small>Actualizado ${e(date(gateway.latestAt))}</small>`:''}</div>${reading('encoder',values.encoder,previous.encoder)}${reading('distance',values.distance,previous.distance)}`;
    if(values.encoder)previous.encoder=Number(values.encoder.value);
    if(values.distance)previous.distance=Number(values.distance.value);
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
