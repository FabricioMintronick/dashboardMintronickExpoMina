'use strict';
const {MongoClient}=require('mongodb');
const {uri,MONGO_DB,COLLECTION}=require('../src/config');

const mode=process.argv[2],gateway=process.env.SENSOR_TEST_GATEWAY||'Gateway01';
if(!['write','clean'].includes(mode)){
  console.log('Uso: npm run sensors:test-data -- write | clean');
  console.log(`Gateway de prueba: ${gateway} (cambiar con SENSOR_TEST_GATEWAY)`);
  process.exit(0);
}
if(!uri)throw new Error('Falta MONGO_URI');

(async()=>{
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
  try{
    await client.connect();
    const collection=client.db(MONGO_DB).collection(COLLECTION);
    if(mode==='clean'){
      const result=await collection.deleteMany({_sensorDashboardTest:true,gateway});
      console.log(`Lecturas de prueba eliminadas: ${result.deletedCount}`);
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
