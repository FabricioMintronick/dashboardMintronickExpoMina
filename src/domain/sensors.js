'use strict';
const SENSOR_VARIABLES={
 encoder:{label:'Ángulo',unit:'°',aliases:['ENCODER','ROTACION','ROTACIÓN','ANGULO','ÁNGULO','ROTATION','ANGLE','POSITION']},
 distance:{label:'Distancia',unit:'mm',aliases:['LINEAR','SENSOR_LINEAL','DISTANCIA','DISTANCE']}
};
const normalized=value=>String(value??'').trim().toUpperCase();
const numeric=value=>{if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
function valueFrom(doc,spec){for(const field of spec.aliases){const value=numeric(doc[field]??doc[field.toLowerCase()]);if(value!==null)return value;}return spec.aliases.includes(normalized(doc.variable))?numeric(doc.value):null;}
function sensorSnapshot(docs,now=Date.now(),staleMs=120000){const gateways=new Map();for(const doc of docs){const gateway=String(doc.gateway||'').trim(),at=new Date(doc.date??doc.at).getTime();if(!gateway||!Number.isFinite(at))continue;if(!gateways.has(gateway))gateways.set(gateway,{gateway,variables:{}});const target=gateways.get(gateway);for(const [key,spec] of Object.entries(SENSOR_VARIABLES)){const value=valueFrom(doc,spec),previous=target.variables[key];if(value===null||previous&&new Date(previous.at).getTime()>=at)continue;target.variables[key]={sensorId:String(doc.sensorId||doc.sensor||'').trim()||null,label:spec.label,unit:String(doc.unit||spec.unit),value,at:new Date(at).toISOString(),quality:now-at<=staleMs?'fresh':'stale'};}}return [...gateways.values()].sort((a,b)=>a.gateway.localeCompare(b.gateway)).map(item=>({...item,latestAt:Object.values(item.variables).map(value=>value.at).sort().at(-1)||null}));}
module.exports={SENSOR_VARIABLES,sensorSnapshot,valueFrom};
