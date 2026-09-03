const test=require('node:test');
const assert=require('node:assert/strict');

test('period performance derives counter deltas without treating missing data as zero',async()=>{
  const {performanceFrom}=await import('../public/app/period-performance.js');
  const series=(start,end)=>({bucketMs:0,points:[{t:'2026-09-03T12:00:00Z',v:start},{t:'2026-09-03T20:00:00Z',v:end}]});
  const result=performanceFrom({hours:series(100,108.4),fuelTotal:series(500,595),idleHours:series(20,22.1),idleFuel:series(80,98)});
  assert.ok(Math.abs(result.worked-8.4)<1e-9);
  assert.equal(result.litres,95);
  assert.ok(Math.abs(result.average-95/8.4)<1e-9);
  assert.ok(Math.abs(result.utilization-75)<1e-9);
  assert.equal(result.operatingFuel,77);
  const missing=performanceFrom({hours:{points:[]},fuelTotal:series(1,2),idleHours:series(1,1),idleFuel:series(1,1)});
  assert.equal(missing.worked,null);
  assert.equal(missing.average,null);
  assert.equal(missing.utilization,null);
});

test('period performance rejects reset counters and summarized boundaries',async()=>{
  const {counterDelta}=await import('../public/app/period-performance.js');
  assert.equal(counterDelta({points:[{v:10},{v:2}]}).value,null);
  assert.equal(counterDelta({bucketMs:60000,points:[{v:10},{v:12}]}).value,null);
});

test('period performance ignores an alternating secondary counter scale',async()=>{
  const {counterDelta}=await import('../public/app/period-performance.js');
  const result=counterDelta({bucketMs:0,points:[{t:'a',v:649.9},{t:'b',v:10.47},{t:'c',v:649.9},{t:'d',v:650.3}]});
  assert.ok(Math.abs(result.value-.4)<1e-9);
  const realReset=counterDelta({bucketMs:0,points:[{v:650},{v:2},{v:2.5},{v:3}]});
  assert.equal(realReset.value,null);
});
