import { escape as e, number, date, quality, state, condition } from './format.js';
const paths={home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',equipment:'M3 6h7v7H3zM14 6h7v7h-7zM3 17h7M14 17h7',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',alerts:'m12 3 10 18H2zM12 9v5M12 17v1',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2',reports:'M5 3h14v18H5zM8 16v-3M12 16V8M16 16v-5',maintenance:'m14 4 3 3 4-2a6 6 0 0 1-8 8l-7 8-3-3 8-7a6 6 0 0 1 3-7',signal:'M4 19v-3M9 19v-7M14 19V8M19 19V4',gps:'M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',back:'m10 5-7 7 7 7M3 12h18',menu:'M3 6h18M3 12h18M3 18h18',bell:'M6 9a6 6 0 0 1 12 0v6l3 3H3l3-3zM10 21h4'};
export function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.equipment}"/></svg>`;}
let dialog, returnFocus;
export function openEquipment(item){
  if(!dialog){dialog=document.createElement('dialog');dialog.className='quick-dialog';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>returnFocus?.focus());}
  returnFocus=document.activeElement;
  dialog.innerHTML=`<div class="quick-head"><div><small>FICHA RÁPIDA</small><h2>${e(item.name)}</h2></div><button class="button secondary" data-close aria-label="Cerrar ficha">✕</button></div><div class="quick-body"><img src="/tractor-d8.png" alt="Tractor de orugas"><div>${state(item)} ${quality(item.communication)}<p>${condition(item)}</p><small>${e(item.gateway)} · Consulta de últimas lecturas</small></div></div><div class="quick-metrics">${['hours','rpm','fuel','coolant','speed','voltage'].map(key=>{const m=item.metrics[key];return `<div><small>${e(m.label)}</small><strong>${number(m.value)} <em>${e(m.unit)}</em></strong>${quality(m.quality)}<p>${e(date(m.at))}</p></div>`;}).join('')}</div>${item.alarms.length?`<div class="notice warning">${item.alarms.map(a=>e(a.label)).join(' · ')}</div>`:''}<div class="quick-actions"><a class="button" href="#equipment/${encodeURIComponent(item.id)}">Ficha completa →</a><a class="button secondary" href="#map/${encodeURIComponent(item.id)}">Ver GPS</a><a class="button secondary" href="#history/${encodeURIComponent(item.id)}">Ver historial</a></div>`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelectorAll('a').forEach(a=>a.onclick=()=>dialog.close());
  if(!dialog.open)dialog.showModal();
}
let audio=null, enabled=false, started=false;const active=new Map();
export function toggleSound(){
  enabled=!enabled;
  if(enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){enabled=false;return false;}audio ||= new Audio();audio.resume().catch(()=>{});beep();}
  return enabled;
}
function beep(){if(!enabled||!audio)return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.09,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);oscillator.start();oscillator.stop(audio.currentTime+.3);}
export function observeAlarms(items){
  const added=[];
  for(const item of items){
    if(item.alarmQuality!=='fresh')continue;
    const previous=active.get(item.id)||new Set();
    for(const alarm of item.alarms)if(!previous.has(alarm.code)&&started)added.push({item,alarm});
    if(item.condition==='no-reported-alerts')active.set(item.id,new Set());
    else active.set(item.id,new Set([...previous,...item.alarms.map(a=>a.code)].filter(code=>item.alarmStates?.[code]!==false)));
  }
  started=true;
  if(added.length){beep();let toast=document.querySelector('#alarm-toast');if(!toast){toast=document.createElement('div');toast.id='alarm-toast';toast.role='status';document.body.append(toast);}toast.innerHTML=`${icon('bell')}<a href="#alerts">${added.length} nuevas alarmas observadas · ${e(added[0].item.name)}</a><button aria-label="Cerrar notificación">✕</button>`;toast.hidden=false;toast.querySelector('button').onclick=()=>toast.hidden=true;}
  const counter=document.querySelector('#bell-count');if(counter)counter.textContent=items.filter(i=>i.alarms.length&&i.alarmQuality==='fresh').length;
}
