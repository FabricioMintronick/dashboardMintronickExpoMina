import {getJSON} from './api.js';
import {mount} from './map-explorer.js';
const page=document.querySelector('#page');let cleanup=()=>{};
async function load(){try{const fleet=await getJSON('/api/fleet');cleanup=await mount(page,{items:fleet.equipment.filter(i=>!i.test),id:null,standalone:true})||(()=>{});}catch(error){page.innerHTML=`<div class="error-box"><h2>No se pudo abrir el mapa</h2><p>${String(error.message||error)}</p><button class="button" id="retry-map">Reintentar</button></div>`;document.querySelector('#retry-map').onclick=load;}}
load();const timer=setInterval(async()=>{if(document.hidden||!cleanup.update)return;try{const fleet=await getJSON('/api/fleet');cleanup.update(fleet.equipment.filter(i=>!i.test));}catch{}},2000);window.addEventListener('beforeunload',()=>{clearInterval(timer);cleanup();});
