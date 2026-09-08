import {machineImage} from './machine.js';
import {mountNotificationCenter} from './notification-center.js';
import { escape as e, number, date, quality, state, condition } from './format.js';
const paths={home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',equipment:'M3 6h7v7H3zM14 6h7v7h-7zM3 17h7M14 17h7',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',alerts:'m12 3 10 18H2zM12 9v5M12 17v1',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2',reports:'M5 3h14v18H5zM8 16v-3M12 16V8M16 16v-5',install:'M12 3v12M7 10l5 5 5-5M5 21h14',maintenance:'m14 4 3 3 4-2a6 6 0 0 1-8 8l-7 8-3-3 8-7a6 6 0 0 1 3-7',signal:'M4 19v-3M9 19v-7M14 19V8M19 19V4',gps:'M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',back:'m10 5-7 7 7 7M3 12h18',menu:'M3 6h18M3 12h18M3 18h18',bell:'M6 9a6 6 0 0 1 12 0v6l3 3H3l3-3zM10 21h4',logout:'M10 17l5-5-5-5M15 12H3M14 3h7v18h-7',fullscreen:'M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5',fullscreenExit:'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5'};
const solidIcons={
  home:'<rect x="3" y="3" width="8" height="10" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="3" width="7" height="6" rx="2" class="icon-tint" stroke="none"/><rect x="3" y="16" width="8" height="5" rx="2" class="icon-tint" stroke="none"/><rect x="14" y="12" width="7" height="9" rx="2" fill="currentColor" stroke="none"/>',
  equipment:'<rect x="2" y="12" width="20" height="9" rx="4" class="icon-tint" stroke="none"/><path d="M5 17h14M5 12V7h7l3 5M8 7V4h6l3 8M19 9v6"/><circle cx="6" cy="17" r="1" fill="currentColor"/><circle cx="18" cy="17" r="1" fill="currentColor"/>',
  map:'<path d="m2 6 6-3 8 3 6-3v15l-6 3-8-3-6 3z" class="icon-tint" stroke="none"/><path d="M8 4v13M16 14v6"/><path d="M12 7a4 4 0 0 1 8 0c0 3-4 7-4 7s-4-4-4-7Z" fill="currentColor" stroke="none"/><circle cx="16" cy="7" r="1.5" class="icon-hole" stroke="none"/>',
  alerts:'<path d="m12 2 11 19H1z" class="icon-tint" stroke="none"/><path d="m12 5 8 14H4z"/><path d="M12 10v4" stroke-width="2.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  history:'<circle cx="13" cy="12" r="9" class="icon-tint" stroke="none"/><path d="M4 12a8 8 0 1 1 2 6M3 5v7h6M13 7v5l4 2"/>',
  reports:'<rect x="4" y="2" width="16" height="20" rx="3" class="icon-tint" stroke="none"/><path d="M8 17v-4M12 17V8M16 17v-7" stroke-width="2.7"/><path d="M8 5h7"/>',
  maintenance:'<path d="m14 3 3 4 5-1a7 7 0 0 1-9 9l-6 7-5-5 7-6a7 7 0 0 1 5-8" class="icon-tint" stroke="none"/><path d="m14 4 3 3 4-1a6 6 0 0 1-8 7l-7 8-3-3 8-7a6 6 0 0 1 3-7Z"/><circle cx="6" cy="18" r="1" fill="currentColor"/>',
  bell:'<path d="M4 18h16l-2-4V9a6 6 0 0 0-12 0v5z" class="icon-tint" stroke="none"/><path d="M6 14V9a6 6 0 0 1 12 0v5l2 4H4zM10 21h4"/><circle cx="19" cy="5" r="3" class="icon-accent" stroke="none"/>'
};
export function icon(name){return `<svg class="ui-icon duotone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${solidIcons[name]||`<path d="${paths[name]||paths.equipment}"/>`}</svg>`;}
let dialog, returnFocus, quickId, quickActionsEnabled=true;
const metricQuality=metric=>['missing','invalid'].includes(metric?.quality)?quality(metric.quality):'';
export function openEquipment(item,{actions=true}={}){
  if(notificationDialog?.open)notificationDialog.close();
  if(!dialog){dialog=document.createElement('dialog');dialog.className='quick-dialog';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>returnFocus?.focus());}
  returnFocus=document.activeElement;quickId=item.id;quickActionsEnabled=actions;
  dialog.innerHTML=`<div class="quick-head"><div><small>FICHA RÁPIDA</small><h2>${e(item.name)}</h2></div><button class="button secondary" data-close aria-label="Cerrar ficha">✕</button></div><div class="quick-body">${machineImage(item)}<div data-quick-status>${state(item)} ${quality(item.communication)}<p>${condition(item)}</p><small>${e(item.gateway)} · Lecturas al ${e(date(item.lastAt))}</small></div></div><div class="quick-metrics">${['hours','rpm','fuel','coolant','speed','voltage'].map(key=>{const m=item.metrics[key];return `<div><small>${e(m.label)}</small><strong>${number(m.value)} <em>${e(m.unit)}</em></strong>${metricQuality(m)}</div>`;}).join('')}</div>${actions&&item.alarms.length?`<button class="button secondary quick-alert-action" data-notifications data-notification-equipment="${e(item.id)}">${icon('alerts')} Ver ${item.alarms.length} ${item.alarms.length===1?'aviso':'avisos'}</button>`:''}${actions?`<div class="quick-actions"><a class="button" href="#equipment/${encodeURIComponent(item.id)}">Ficha completa →</a><a class="button secondary" href="#map/${encodeURIComponent(item.id)}">${icon('gps')} GPS</a><a class="button secondary" href="#history/${encodeURIComponent(item.id)}">${icon('history')} Historial</a></div>`:''}`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelectorAll('a').forEach(a=>a.onclick=()=>dialog.close());
  if(!dialog.open)dialog.showModal();
}
let audio=null, enabled=false, started=false;const active=new Map(),lastNotice=new Map();
let notificationEquipment=null;
let notificationDialog=null, notificationFocus=null, latestItems=[],notificationView=null;
export function openNotifications(equipmentId){
  if(dialog?.open)dialog.close();
  if(!notificationDialog){notificationDialog=document.createElement('dialog');notificationDialog.className='quick-dialog notification-dialog';notificationDialog.setAttribute('aria-labelledby','notification-title');document.body.append(notificationDialog);notificationDialog.addEventListener('click',event=>{if(event.target===notificationDialog)notificationDialog.close();});notificationDialog.addEventListener('close',()=>{notificationView?.();notificationView=null;notificationFocus?.focus();});}
  notificationFocus=document.activeElement;notificationEquipment=equipmentId||null;
  notificationView?.();notificationView=mountNotificationCenter(notificationDialog,equipmentId?latestItems.filter(i=>i.id===equipmentId):latestItems,{equipmentId:equipmentId||null});
  notificationDialog.showModal();
}
export function toggleSound(){
  enabled=!enabled;
  if(enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){enabled=false;return false;}audio ||= new Audio();audio.resume().catch(()=>{});beep();}
  return enabled;
}
function beep(){if(!enabled||!audio)return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.09,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);oscillator.start();oscillator.stop(audio.currentTime+.3);}
export function observeAlarms(items){
  latestItems=items;
  if(dialog?.open){const item=items.find(i=>i.id===quickId);if(item){
    dialog.querySelector('[data-quick-status]').innerHTML=state(item)+' '+quality(item.communication)+'<p>'+condition(item)+'</p><small>'+e(item.gateway)+' · Lecturas al '+e(date(item.lastAt))+'</small>';
    ['hours','rpm','fuel','coolant','speed','voltage'].forEach((key,index)=>{const m=item.metrics[key],cell=dialog.querySelector('.quick-metrics').children[index];cell.innerHTML='<small>'+e(m.label)+'</small><strong>'+number(m.value)+' <em>'+e(m.unit)+'</em></strong>'+metricQuality(m);});
    let alarmButton=dialog.querySelector('[data-notification-equipment]');if(!quickActionsEnabled)alarmButton?.remove();else{if(!alarmButton){alarmButton=document.createElement('button');alarmButton.className='button secondary quick-alert-action';alarmButton.dataset.notifications='';alarmButton.dataset.notificationEquipment=item.id;dialog.querySelector('.quick-actions')?.before(alarmButton);}alarmButton.hidden=!item.alarms.length;alarmButton.innerHTML=icon('alerts')+' Ver '+item.alarms.length+' '+(item.alarms.length===1?'aviso':'avisos');}
  }}

  if(notificationDialog?.open)notificationView?.update(notificationEquipment?items.filter(i=>i.id===notificationEquipment):items);
  const added=[];
  for(const item of items){
    if(item.alarmQuality!=='fresh')continue;
    const previous=active.get(item.id)||new Set();
    for(const alarm of item.alarms)if(!previous.has(alarm.code)&&started&&Date.now()-(lastNotice.get(item.id+':'+alarm.code)||0)>120000){added.push({item,alarm});lastNotice.set(item.id+':'+alarm.code,Date.now());}
    if(item.condition==='no-reported-alerts')active.set(item.id,new Set());
    else active.set(item.id,new Set([...previous,...item.alarms.map(a=>a.code)].filter(code=>item.alarmStates?.[code]!==false)));
  }
  started=true;
  const counter=document.querySelector('#bell-count');if(counter)counter.textContent=items.reduce((n,i)=>n+(i.alarmQuality==='fresh'?i.alarms.length:0),0);
}
