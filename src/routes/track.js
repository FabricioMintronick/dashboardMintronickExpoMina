'use strict';
const {numeric}=require('../domain/telemetry');
const {offsetLocation}=require('../domain/location-privacy');
function registerTrackRoutes(app,{getDb,collection,gpsPrivacyEnabled=false,gpsLatOffset=0,gpsLonOffset=0}){
  app.get('/api/telemetry/track',async(req,res)=>{
    const gateway=req.query.gateway,from=new Date(req.query.from),to=new Date(req.query.to);
    if(typeof gateway!=='string'||!gateway||gateway.length>80||!Number.isFinite(to-from)||to<=from||to-from>86400000)return res.status(400).json({error:'Selecciona un equipo y un rango válido de hasta 24 horas.'});
    if(!getDb())return res.status(503).json({error:'Base de datos no disponible'});
    try{
      const rows=await getDb().collection(collection).aggregate([
        {$match:{gateway,name:'LOCATION',date:{$gte:from,$lte:to}}},{$sort:{date:1}},
        {$group:{_id:{$subtract:[{$toLong:'$date'},{$mod:[{$toLong:'$date'},30000]}]},point:{$last:{t:'$date',lat:'$latitude',lon:'$longitude',speed:'$speed'}}}},{$sort:{_id:1}},{$limit:2882}
      ],{maxTimeMS:10000}).toArray();
      const points=rows.map(r=>({...r.point,lat:numeric(r.point.lat),lon:numeric(r.point.lon),speed:numeric(r.point.speed)})).filter(p=>p.lat!==null&&p.lon!==null&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180&&!(p.lat===0&&p.lon===0)).map(p=>offsetLocation(p,gateway,gpsPrivacyEnabled,gpsLatOffset,gpsLonOffset));
      res.json({from,to,points,sampleMs:30000,note:'Última posición de cada intervalo de 30 s. Recorrido muestreado; las interrupciones no se interpolan.'});
    }catch{res.status(503).json({error:'No se pudo consultar el recorrido. Prueba un periodo menor.'});}
  });
}
module.exports={registerTrackRoutes};
