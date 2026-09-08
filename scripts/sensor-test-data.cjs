'use strict';
const {MongoClient}=require('mongodb');
const {uri,MONGO_DB,COLLECTION}=require('../src/config');

const mode=process.argv[2],gateway=process.env.SENSOR_TEST_GATEWAY||'Gateway01';
if(!['write','series','verify','clean'].includes(mode)){
  console.log('Uso: npm run sensors:test-data -- write | series | verify | clean');
  console.log(`Gateway de prueba: ${gateway} (cambiar con SENSOR_TEST_GATEWAY)`);
  process.exit(0);
}
if(!uri)throw new Error('Falta MONGO_URI');

(async()=>{
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
  try{
    await client.connect();
    const collection=client.db(MONGO_DB).collection(COLLECTION);
    if(mode==='verify'){
      const started=Date.now(),filter={name:{$in:['ENCODER','SENSOR_LINEAL']}};
      const rows=await collection.find(filter).sort({date:-1}).limit(20).maxTimeMS(8000).toArray();
      console.log(JSON.stringify({documents:rows.length,milliseconds:Date.now()-started,latest:rows.slice(0,4).map(row=>({gateway:row.gateway,name:row.name,angle:row.ANGULO,distance:row.DISTANCIA,date:row.date}))},null,2));
      return;
    }
    if(mode==='clean'){
      const result=await collection.deleteMany({_sensorDashboardTest:true,gateway});
      console.log(`Lecturas de prueba eliminadas: ${result.deletedCount}`);
      return;
    }
    if(mode==='series'){
      const samples=[[-35,120],[-20,230],[0,360],[18,510],[36,680],[55,860],[32,720],[10,540],[-12,330],[-30,160]];
      const interval=Math.max(2100,Number(process.env.SENSOR_TEST_INTERVAL_MS)||2500);
      console.log(`Enviando ${samples.length} posiciones a ${gateway}; mantén abierta la vista Sensores.`);
      for(let index=0;index<samples.length;index++){
        const [angle,distance]=samples[index],now=new Date();
        await collection.insertMany([
          {customer:1,gateway,name:'ENCODER',ANGULO:angle,date:now,received_at:now,source:'B',_sensorDashboardTest:true},
          {customer:1,gateway,name:'SENSOR_LINEAL',DISTANCIA:distance,date:new Date(now.getTime()+1),received_at:now,source:'B',_sensorDashboardTest:true}
        ]);
        console.log(`${index+1}/${samples.length}: ${angle}° · ${distance} mm`);
        if(index<samples.length-1)await new Promise(resolve=>setTimeout(resolve,interval));
      }
      return;
    }
    const now=new Date(),receivedAt=new Date();
    const result=await collection.insertMany([
      {customer:1,gateway,name:'ENCODER',ANGULO:37.4,date:now,received_at:receivedAt,source:'B',_sensorDashboardTest:true},
      {customer:1,gateway,name:'SENSOR_LINEAL',DISTANCIA:428.2,date:new Date(now.getTime()+1),received_at:receivedAt,source:'B',_sensorDashboardTest:true}
    ]);
    console.log(`Lecturas insertadas: ${result.insertedCount}. Abre Sensores y espera hasta 2 segundos.`);
  }finally{await client.close();}
})().catch(error=>{console.error(`Prueba fallida: ${error.message}`);process.exitCode=1;});
