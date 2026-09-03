import {attentionCard} from './attention-cards.js';
import {overviewCards} from './overview-graphics.js';
import {attentionReason} from './home-insights.js';
import {escape as e,number,date,state} from './format.js';
import {icon,openEquipment} from './ui.js';

export function commandCenter(page,{items}){
  let current=items,map=null,markers=null,attentionMode='alarm',themeObserver=null,lastKpis='',lastMapSignature='',openPopupId=null;const markerById=new Map();
  page.innerHTML=`<div id="command-kpis"></div><div class="command-map-row"><section class="panel home-map-panel"><div class="panel-head"><h2>Ubicación</h2><div class="home-map-buttons"><button class="button secondary" id="home-zone">Zona principal</button><button class="button secondary" id="home-all">Toda la flota</button><button class="button secondary" id="home-map-full" aria-label="Ampliar mapa">⛶</button></div></div><div id="command-map"></div><div id="home-map-caption" class="command-map-caption"></div></section><section class="panel attention-panel"><div class="panel-head"><h2>Atención por equipo</h2><a class="pill-link" href="#alerts">Ver alertas →</a></div><div class="attention-tabs" role="group" aria-label="Motivo de atención"><button data-attention="alarm">${icon('alerts')} Alarmas <b></b></button><button data-attention="offline">${icon('signal')} Sin comunicación <b></b></button></div><div id="command-attention"></div></section></div>`;

  function renderAttention(){
    const matches=(item,mode)=>mode==='alarm'?attentionReason(item)?.kind==='alarm':attentionReason(item)?.kind==='offline';
    const filtered=current.filter(item=>matches(item,attentionMode)).sort((a,b)=>b.alarms.filter(x=>x.quality==='fresh').length-a.alarms.filter(x=>x.quality==='fresh').length||a.name.localeCompare(b.name));
    page.querySelectorAll('[data-attention]').forEach(button=>{button.classList.toggle('selected',button.dataset.attention===attentionMode);button.setAttribute('aria-pressed',String(button.dataset.attention===attentionMode));button.querySelector('b').textContent=current.filter(item=>matches(item,button.dataset.attention)).length;});
    const list=page.querySelector('#command-attention'),scroll=list.scrollTop;list.innerHTML=filtered.map(attentionCard).join('')||'<div class="empty">No hay equipos en este grupo.</div>';list.scrollTop=scroll;
  }

  let baseTiles=null;
  if(window.L){
    map=L.map('command-map',{scrollWheelZoom:true,zoomControl:true}).setView([-12,-77],5);
    const light=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}),dark=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Sources: Esri, HERE, Garmin, © OpenStreetMap contributors'});
    const applyTheme=()=>{if(baseTiles)map.removeLayer(baseTiles);baseTiles=(document.documentElement.dataset.theme==='dark'?dark:light).addTo(map);};
    applyTheme();themeObserver=new MutationObserver(applyTheme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});markers=L.layerGroup().addTo(map);L.control.scale({imperial:false}).addTo(map);
  }
  const located=()=>current.filter(item=>item.location);
  function fit(list){if(map&&list.length)map.fitBounds(list.map(item=>[item.location.lat,item.location.lon]),{padding:[45,45],maxZoom:16});}
  function zone(){if(!map)return;const list=located(),groups=list.map(item=>list.filter(other=>map.distance([item.location.lat,item.location.lon],[other.location.lat,other.location.lon])<20000)).sort((a,b)=>b.length-a.length);fit(groups[0]||[]);}
  function popup(item){const speed=item.metrics?.speed;return `<div class="home-equipment-popup"><strong>${e(item.name)}</strong>${state(item)}<span>${speed?.value==null?'Velocidad sin lectura':`${number(speed.value)} ${e(speed.unit)}`}</span><small>${e(date(item.location?.at||item.lastAt))}</small><button type="button" class="button" data-popup-quick="${e(item.id)}">Ficha rápida</button><a class="button secondary" href="#map/${encodeURIComponent(item.id)}">Abrir mapa</a></div>`;}
  function drawMap(){
    if(!map)return;const desiredPopup=openPopupId;markers.clearLayers();openPopupId=desiredPopup;markerById.clear();const list=located(),groups=[];
    for(const item of list){const point=map.latLngToContainerPoint([item.location.lat,item.location.lon]),group=groups.find(value=>value.point.distanceTo(point)<34);if(group)group.items.push(item);else groups.push({point,items:[item]});}
    for(const group of groups){if(group.items.length>1&&map.getZoom()<15){const marker=L.marker([group.items[0].location.lat,group.items[0].location.lon],{icon:L.divIcon({className:'geo-cluster',html:`<b>${group.items.length}</b>`,iconSize:[38,38],iconAnchor:[19,19]})}).addTo(markers);marker.bindTooltip(`${group.items.length} equipos`);marker.on('click',()=>map.fitBounds(L.latLngBounds(group.items.map(item=>[item.location.lat,item.location.lon])),{maxZoom:17,padding:[45,45]}));continue;}
      group.items.forEach(item=>{const marker=L.marker([item.location.lat,item.location.lon],{icon:L.divIcon({className:`geo-machine home-map-machine state-${item.communication==='fresh'?'fresh':'offline'}`,html:'<img src="/tractor-d8-transparent.png" alt="">',iconSize:[40,30],iconAnchor:[20,15]})}).addTo(markers);markerById.set(item.id,marker);marker.bindTooltip(e(item.name),{direction:'top',className:'equipment-map-label'});marker.bindPopup(popup(item),{className:'equipment-map-popup',maxWidth:260});marker.on('popupopen',event=>{openPopupId=item.id;event.popup.getElement()?.querySelector('[data-popup-quick]')?.addEventListener('click',()=>openEquipment(item),{once:true});});marker.on('popupclose',()=>{if(openPopupId===item.id)openPopupId=null;});});
    }
    page.querySelector('#home-map-caption').innerHTML=`<b>${list.length}</b> equipos con ubicación · Toca un equipo para consultar su estado`;if(openPopupId&&markerById.has(openPopupId))markerById.get(openPopupId).openPopup();
  }
  if(map){map.on('moveend',drawMap);}else page.querySelector('#command-map').innerHTML='<div class="empty">Mapa no disponible.</div>';
  page.querySelector('#home-zone').onclick=zone;page.querySelector('#home-all').onclick=()=>fit(located());
  const mapPanel=page.querySelector('.home-map-panel'),fullButton=page.querySelector('#home-map-full');
  fullButton.onclick=async()=>{try{if(document.fullscreenElement===mapPanel)await document.exitFullscreen();else await mapPanel.requestFullscreen();}catch{fullButton.title='Pantalla completa no disponible';}};
  const syncFullscreen=()=>{const active=document.fullscreenElement===mapPanel;fullButton.textContent=active?'✕':'⛶';fullButton.setAttribute('aria-label',active?'Salir de pantalla completa':'Ampliar mapa');[0,100,300].forEach(delay=>setTimeout(()=>map?.invalidateSize({pan:false}),delay));};
  document.addEventListener('fullscreenchange',syncFullscreen);
  const click=event=>{const tab=event.target.closest('[data-attention]');if(tab){attentionMode=tab.dataset.attention;renderAttention();}};page.addEventListener('click',click);
  function update(next,initial=false){current=next;const html=overviewCards(next).replace('En comunicación','Con datos').replace('Ubicación reciente','GPS vigente');if(html!==lastKpis){page.querySelector('#command-kpis').innerHTML=html;lastKpis=html;}renderAttention();const mapSignature=next.map(item=>`${item.id}:${item.location?.lat}:${item.location?.lon}:${item.communication}`).join('|');if(initial||mapSignature!==lastMapSignature){lastMapSignature=mapSignature;drawMap();}if(initial)zone();}
  update(items,true);
  const stop=()=>{themeObserver?.disconnect();map?.remove();page.removeEventListener('click',click);document.removeEventListener('fullscreenchange',syncFullscreen);};stop.update=update;return stop;
}
