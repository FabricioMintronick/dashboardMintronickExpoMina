import { escape as e, date, age, quality, state, condition } from './format.js';
export async function mount(page, { items, id, panel }) {
  const selected = items.find(i => i.id === id);
  page.innerHTML = `<div class="toolbar"><label class="grow">Buscar en el mapa<input id="map-search" type="search" placeholder="Nombre o gateway…"></label><label>Posiciones<select id="map-filter"><option value="all">Todas las posiciones</option><option value="fresh">Solo GPS reciente</option><option value="alarm">Con alarma en última lectura</option></select></label><button class="button secondary" id="map-fit">Ver todos</button></div>
  <section class="panel"><div class="map-layout"><div id="map-list" class="map-list" aria-label="Equipos en mapa"></div><div class="map-canvas" id="fleet-map" role="region" aria-label="Mapa de posiciones de los equipos"></div></div><div class="map-foot"><div class="legend"><span>GPS reciente</span><span class="old">GPS atrasado</span><span class="alarm">Alarma reportada con GPS reciente</span></div><p>Los grupos se expanden al acercar el mapa. Las posiciones individuales nunca se desplazan artificialmente. La lista permite abrir equipos superpuestos.</p></div></section><div class="notice">${items.filter(i=>!i.location).length} equipos sin coordenadas válidas. Este mapa no permite prevenir colisiones. Capas de mina y geocercas requieren cartografía y reglas de la operación.</div>`;
  if(!window.L)throw new Error('No se pudo cargar la biblioteca de mapas. Comprueba la conexión a Internet.');
  const map=L.map('fleet-map',{scrollWheelZoom:true}).setView([-9.2,-75],5);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  let tileWarning=false;
  tiles.on('tileerror',()=>{if(!tileWarning){tileWarning=true;page.querySelector('.map-foot p').textContent='No se pudo cargar parte del mapa base. Las posiciones recibidas siguen disponibles en la lista.';}});
  const layer=L.layerGroup().addTo(map);
  let filtered=items;
  function popup(item){const box=document.createElement('div');box.innerHTML=`<strong>${e(item.name)}</strong><p>${state(item)} ${quality(item.location.quality)}</p><p>Posición: ${e(date(item.location.at))}</p><p>${condition(item)}</p><p><a href="#equipment/${encodeURIComponent(item.id)}">Abrir equipo →</a></p>`;return box;}
  function drawMarkers(){
    layer.clearLayers();const groups=[];
    for(const item of filtered.filter(i=>i.location)){
      const point=map.latLngToContainerPoint([item.location.lat,item.location.lon]);
      const group=groups.find(g=>g.point.distanceTo(point)<30);
      if(group)group.items.push(item);else groups.push({point,items:[item]});
    }
    for(const group of groups){
      const first=group.items[0], multi=group.items.length>1;
      const icon=L.divIcon({className:`map-marker ${multi?'cluster':first.location.quality!=='fresh'?'stale':first.condition==='reported'?'alarm':''}`,html:multi?String(group.items.length):'',iconSize:multi?[32,32]:[19,19]});
      const marker=L.marker([first.location.lat,first.location.lon],{icon}).addTo(layer);
      if(multi){const box=document.createElement('div');box.innerHTML=`<strong>${group.items.length} equipos en esta zona</strong><p>${group.items.map(i=>`<a href="#equipment/${encodeURIComponent(i.id)}">${e(i.name)}</a>`).join('<br>')}</p>`;marker.bindPopup(box);marker.on('click',()=>{if(map.getZoom()<18)map.setView(marker.getLatLng(),Math.min(map.getZoom()+2,18));});}
      else marker.bindTooltip(first.name).bindPopup(popup(first));
    }
  }
  function focus(item){if(!item.location)return;map.setView([item.location.lat,item.location.lon],18);L.popup().setLatLng([item.location.lat,item.location.lon]).setContent(popup(item)).openOn(map);}
  function fit(){const points=filtered.filter(i=>i.location).map(i=>[i.location.lat,i.location.lon]);if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:16});}
  function filter(){const query=page.querySelector('#map-search').value.toLowerCase(),mode=page.querySelector('#map-filter').value;filtered=items.filter(i=>`${i.name} ${i.gateway}`.toLowerCase().includes(query)&&(mode==='all'||mode==='fresh'&&i.location?.quality==='fresh'||mode==='alarm'&&i.alarms.length));page.querySelector('#map-list').innerHTML=filtered.map(i=>`<button class="map-item" data-id="${e(i.id)}"><strong>${e(i.name)}</strong><p>${i.location?e(age(i.location.at)):'Sin ubicación válida'}</p>${quality(i.location?.quality || 'missing')}</button>`).join('') || '<div class="empty">Sin coincidencias</div>';page.querySelectorAll('.map-item').forEach(button=>button.addEventListener('click',()=>focus(filtered.find(i=>i.id===button.dataset.id))));drawMarkers();}
  page.querySelector('#map-search').addEventListener('input',filter);page.querySelector('#map-filter').addEventListener('change',filter);page.querySelector('#map-fit').addEventListener('click',fit);map.on('zoomend',drawMarkers);filter();fit();if(selected)focus(selected);
  return ()=>map.remove();
}
