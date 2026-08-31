const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {registerHistoryRoutes}=require('../src/routes/history');
async function requestWithCollection(col,query){
  const app=express();registerHistoryRoutes(app,{getDb:()=>({collection:()=>col}),collection:'test',staleMs:120000});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/telemetry/history?${new URLSearchParams(query)}`);return {status:response.status,body:await response.json()};}
  finally{await new Promise(resolve=>server.close(resolve));}
}
test('raw history flags truncation and never adds a seed outside the requested data',async()=>{
  const docs=Array.from({length:5001},(_,i)=>({date:new Date(Date.UTC(2026,7,31,0,0,i)),RPM_MOTOR:i===0?'':700}));
  const cursor={sort(){return this},limit(n){assert.equal(n,5001);return this},maxTimeMS(){return this},async toArray(){return docs}};
  const result=await requestWithCollection({find:()=>cursor},{gateway:'test',signal:'rpm',from:'2026-08-31T00:00:00Z',to:'2026-08-31T02:00:00Z'});
  assert.equal(result.status,200);assert.equal(result.body.truncated,true);assert.equal(result.body.points.length,5000);assert.equal(result.body.points[0].v,null);assert.equal(result.body.points[0].t,docs[0].date.toISOString());
});
test('aggregated history carries extrema instead of hiding them behind averages',async()=>{
  const col={aggregate(pipeline,options){assert.ok(options.maxTimeMS);return {async toArray(){return [{_id:Date.UTC(2026,7,1),v:70,min:40,max:110,count:25}]}}}};
  const result=await requestWithCollection(col,{gateway:'test',signal:'coolant',from:'2026-08-01T00:00:00Z',to:'2026-08-03T00:00:00Z'});
  assert.equal(result.body.bucketMs,300000);assert.equal(result.body.points[0].max,110);assert.equal(result.body.points[0].min,40);assert.equal(result.body.points[0].count,25);assert.equal(result.body.truncated,false);
});
