const test=require('node:test');
const assert=require('node:assert/strict');
const {validateQuery}=require('../src/routes/history');
test('history rejects reversed, oversized, invalid and injected queries',()=>{
  const good={gateway:'test',signal:'rpm',from:'2026-08-01T00:00:00Z',to:'2026-08-02T00:00:00Z'};
  assert.ok(validateQuery(good));
  assert.equal(validateQuery({...good,to:good.from}),null);
  assert.equal(validateQuery({...good,to:'2026-10-01'}),null);
  assert.equal(validateQuery({...good,from:'x'}),null);
  assert.equal(validateQuery({...good,gateway:{$ne:''}}),null);
  assert.equal(validateQuery({...good,signal:'__proto__'}),null);
});
