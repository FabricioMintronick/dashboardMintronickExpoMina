'use strict';
const SENSOR_VARIABLES={
 encoder:{label:'Posición angular',unit:'°',fields:['ENCODER','encoder','ROTACION','rotacion','ROTATION','rotation','ANGULO','angulo','ANGLE','angle','POSITION','position']},
 distance:{label:'Distancia',unit:'mm',fields:['DISTANCIA','distancia','DISTANCE','distance']}
};
const valueFrom=(doc,fields)=>{for(const field of fields){if(doc[field]===null||doc[field]===undefined||doc[field]==='')continue;const value=Number(doc[field]);if(Number.isFinite(value))return value;}return null;};
function sensorSnapshot(docs,now=Date.now(),staleMs=120000){const gateways=new Map();for(const doc of docs){const gateway=String(doc.gateway||'').trim();if(!gateway)continue;const at=new Date(doc.date).getTime();if(!Number.isFinite(at))continue;if(!gateways.has(gateway))gateways.set(gateway,{gateway,variables:{}});const target=gateways.get(gateway);for(const [key,spec] of Object.entries(SENSOR_VARIABLES)){const value=valueFrom(doc,spec.fields),previous=target.variables[key];if(value===null||previous&&new Date(previous.at).getTime()>=at)continue;target.variables[key]={label:spec.label,unit:spec.unit,value,at:new Date(at).toISOString(),quality:now-at<=staleMs?'fresh':'stale'};}}return [...gateways.values()].sort((a,b)=>a.gateway.localeCompare(b.gateway)).map(item=>({...item,latestAt:Object.values(item.variables).map(v=>v.at).sort().at(-1)||null}));}
module.exports={SENSOR_VARIABLES,sensorSnapshot,valueFrom};
