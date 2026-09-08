'use strict';
const crypto=require('node:crypto');
const definitions={ENCODER:{variable:'ANGULO',unit:'°'},SENSOR_LINEAL:{variable:'DISTANCIA',unit:'mm'}};
const safeEqual=(left,right)=>{const a=Buffer.from(String(left)),b=Buffer.from(String(right));return a.length===b.length&&crypto.timingSafeEqual(a,b);};
function normalizeBatch(body,now=new Date()){
  const gateway=String(body?.gateway||'').trim(),readings=body?.readings;
  if(!gateway||gateway.length>80||!Array.isArray(readings)||!readings.length||readings.length>10)throw new Error('PAYLOAD_INVALID');
  const batchDate=new Date(body.date||now);if(!Number.isFinite(batchDate.getTime())||batchDate.getTime()>now.getTime()+60000)throw new Error('DATE_INVALID');
  return readings.map(reading=>{const type=String(reading?.type||'').trim().toUpperCase(),definition=definitions[type],variable=String(reading?.variable||'').trim().toUpperCase(),sensorId=String(reading?.sensorId||'').trim(),value=Number(reading?.value),date=new Date(reading?.date||batchDate);if(!definition||variable!==definition.variable||!sensorId||sensorId.length>80||!Number.isFinite(value)||!Number.isFinite(date.getTime())||date.getTime()>now.getTime()+60000)throw new Error('READING_INVALID');return{gateway,sensorId,type,variable,value,unit:definition.unit,date,receivedAt:now};});
}
function registerSensorIngestRoute(app,{getDb,collection,token}){app.use('/ingest/sensors',require('express').json({limit:'16kb'}));app.post('/ingest/sensors',async(req,res)=>{if(!token||token.length<32)return res.status(503).json({error:'Ingreso de sensores no configurado'});const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!safeEqual(supplied,token))return res.status(401).json({error:'Token inválido'});let docs;try{docs=normalizeBatch(req.body);}catch{return res.status(400).json({error:'Lecturas inválidas'});}try{const db=getDb();if(!db)return res.status(503).json({error:'Base de datos no disponible'});await db.collection(collection).insertMany(docs,{ordered:true});return res.status(202).json({accepted:docs.length,receivedAt:docs[0].receivedAt.toISOString()});}catch{return res.status(503).json({error:'No se pudieron almacenar las lecturas'});}});}
module.exports={registerSensorIngestRoute,normalizeBatch};
