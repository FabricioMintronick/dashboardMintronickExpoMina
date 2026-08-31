const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeEquipment,numeric,freshness,ALARMS}=require('../src/domain/telemetry');
const now=Date.parse('2026-08-31T12:00:00Z');
const at=new Date(now).toISOString();
const old=new Date(now-3600000).toISOString();
const equipment={id:'test',gateway:'test',name:'Test'};
test('missing, empty and malformed values never become zero',()=>{
  for(const value of [null,undefined,'',' ',false,[],{},'21 rpm','NaN',Infinity])assert.equal(numeric(value),null);
  assert.equal(numeric('0'),0);assert.equal(numeric('21.5'),21.5);
});
test('disconnection preserves hourmeter, temperature and alarm evidence',()=>{
  const item=normalizeEquipment(equipment,[{name:'HOURS',date:old,ENG_TOTAL_HOURS:12480},{name:'ET1',date:old,ENG_COOLANT_TEMP:108},{name:'ALARM',date:old,OVERHEATING:1},{name:'STATE',date:old,STATE:'Off'}],now);
  assert.equal(item.metrics.hours.value,12480);assert.equal(item.metrics.coolant.value,108);
  assert.equal(item.metrics.coolant.quality,'stale');assert.equal(item.condition,'last-alert');assert.equal(item.alarms.length,1);
});
test('fresh state does not refresh GPS age',()=>{
  const item=normalizeEquipment(equipment,[{name:'STATE',date:at,STATE:'Duty'},{name:'LOCATION',date:old,latitude:-12,longitude:-77,speed:0}],now);
  assert.equal(item.communication,'fresh');assert.equal(item.state.quality,'fresh');assert.equal(item.location.quality,'stale');assert.equal(item.metrics.speed.value,0);
});
test('missing and partial alarm documents do not prove a healthy condition',()=>{
  assert.equal(normalizeEquipment(equipment,[],now).condition,'unknown');
  assert.equal(normalizeEquipment(equipment,[{name:'ALARM',date:at,OVERHEATING:0}],now).condition,'unknown');
  const complete=Object.fromEntries(Object.keys(ALARMS).map(key=>[key,0]));
  assert.equal(normalizeEquipment(equipment,[{name:'ALARM',date:at,...complete}],now).condition,'no-reported-alerts');
});
test('false string alarm is not active and invalid location is not mapped',()=>{
  const item=normalizeEquipment(equipment,[{name:'ALARM',date:at,OVERHEATING:'false'},{name:'LOCATION',date:at,latitude:200,longitude:-77}],now);
  assert.equal(item.alarms.length,0);assert.equal(item.location,null);
  assert.equal(item.alarmStates.OVERHEATING,false);
  assert.equal(item.alarmStates.LOW_BOOST,null);
});
test('future timestamp is invalid, not fresh',()=>{
  assert.equal(freshness(new Date(now+120000),now,120000),'invalid');
  assert.equal(freshness(null,now,120000),'missing');
});
