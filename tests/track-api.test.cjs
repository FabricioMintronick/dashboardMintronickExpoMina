const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {registerTrackRoutes}=require('../src/routes/track');
test('track validates ranges and removes invalid coordinates without inventing positions',async()=>{
  const app=express();let calls=0;
  registerTrackRoutes(app,{getDb:()=>({collection:()=>({aggregate(){calls++;return {toArray:async()=>[{point:{t:'2026-08-31T00:00:00Z',lat:-12,lon:-77,speed:'0'}},{point:{t:'2026-08-31T00:00:30Z',lat:999,lon:-77}},{point:{t:'2026-08-31T00:01:00Z',lat:0,lon:0}}]}}})}),collection:'test'});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const bad=await fetch(origin+'/api/telemetry/track?gateway=test&from=2026-08-01&to=2026-08-03');assert.equal(bad.status,400);assert.equal(calls,0);
    const res=await fetch(origin+'/api/telemetry/track?gateway=test&from=2026-08-31T00:00:00Z&to=2026-08-31T01:00:00Z');assert.equal(res.status,200);const data=await res.json();assert.equal(data.points.length,1);assert.equal(data.points[0].lat,-12);assert.equal(data.points[0].speed,0);assert.equal(data.sampleMs,30000);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
