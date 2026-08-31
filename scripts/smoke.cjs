// Read-only API check against an explicitly selected local development server.
const assert=require('node:assert/strict');
const origin=process.env.DASHBOARD_URL || 'http://127.0.0.1:4002';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Local origin required');
(async()=>{
  const root=await fetch(origin);assert.equal(root.status,200);
  for(const path of ['/app/main.js','/app/map.js','/app/history.js','/app/reports.js','/app/styles.css','/app/visual.js','/app/visual.css','/assets/mintronick-brand.png','/tractor-d8.png','/tecnico.html','/legacy/technical.js'])assert.equal((await fetch(origin+path)).status,200,path);
  const fleetResponse=await fetch(origin+'/api/fleet');assert.equal(fleetResponse.status,200);
  const fleet=await fleetResponse.json();assert.ok(fleet.equipment.length);
  const item=fleet.equipment.find(i=>i.communication==='fresh'&&i.metrics.rpm.value!==null)||fleet.equipment.find(i=>i.lastAt);
  const end=new Date(new Date(item.metrics.rpm.at || item.lastAt).getTime()+60000),start=new Date(end.getTime()-15*60000);
  const query=new URLSearchParams({gateway:item.gateway,signal:'rpm',from:start.toISOString(),to:end.toISOString()});
  const historyResponse=await fetch(origin+'/api/telemetry/history?'+query);assert.equal(historyResponse.status,200);
  const history=await historyResponse.json();assert.ok(Array.isArray(history.points));assert.equal(history.bucketMs,0);assert.equal(typeof history.truncated,'boolean');
  const invalid=await fetch(origin+'/api/telemetry/history?gateway[x]=bad&signal=rpm');assert.equal(invalid.status,400);
  const unknown=await fetch(origin+'/api/telemetry/history?'+new URLSearchParams({gateway:item.gateway,signal:'bad',from:start.toISOString(),to:end.toISOString()}));assert.equal(unknown.status,400);
  const http=require('node:http');
  const denied=await new Promise((resolve,reject)=>{http.get(origin,{headers:{Host:'external.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(denied,403);
  console.log(JSON.stringify({staticAssets:'ok',equipment:fleet.equipment.length,historyPoints:history.points.length,truncated:history.truncated,invalidQueries:'rejected',externalHost:'rejected'}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
