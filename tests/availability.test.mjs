import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCourt, validDate, koreaToday, fetchAvailability} from '../lib/availability.mjs';
const court={number:1,code:'61'}, date='2026-11-07';
const day=(code='10')=>[{date,state_cd:code,state_nm:code==='10'?'예약가능':'예약불가'}];
const time=(use='N')=>[{start_time:'12:00',end_time:'14:00',use_yn:use,rent_amt:10000,detail:'PRIVATE NAME',rent_no:123}];
test('available requires an open date and a free time',()=>{
 assert.equal(normalizeCourt(court,date,day(),time()).slots[0].status,'available');
 assert.equal(normalizeCourt(court,date,day('20'),time()).slots[0].status,'unavailable');
 assert.equal(normalizeCourt(court,date,day(),time('Y')).slots[0].status,'booked');
 assert.equal(normalizeCourt(court,date,day(),time('E')).slots[0].status,'closed');
});
test('unknown or missing upstream fields do not become availability',()=>{
 assert.throws(()=>normalizeCourt(court,date,[],time()));
 assert.throws(()=>normalizeCourt(court,date,day(),time('unexpected')));
 assert.throws(()=>normalizeCourt(court,date,day(),[...time(),...time()]));
});
test('booking identity fields are stripped',()=>{
 const result=JSON.stringify(normalizeCourt(court,date,day(),time()));
 assert.ok(!result.includes('PRIVATE')); assert.ok(!result.includes('rent_no')); assert.ok(!result.includes('detail'));
});
test('dates validate actual calendar days; today uses Korea midnight',()=>{
 assert.equal(validDate('2026-02-30'),false); assert.equal(validDate('2026-11-07'),true);
 assert.equal(validDate('2026-11-07<script>'),false); assert.equal(validDate(null),false);
 assert.equal(koreaToday(new Date('2026-10-27T15:01:00Z')),'2026-10-28');
});
test('one failed court does not hide the other eight',async()=>{
 const fake=async input=>{const u=new URL(input); if(u.searchParams.get('place_code')==='62')throw new Error('unavailable');return Response.json(u.pathname.includes('month_state')?day():time());};
 const result=await fetchAvailability(date,fake);
 assert.equal(result.courts.length,9); assert.ok(result.courts[1].error);
 assert.equal(result.courts.filter(c=>!c.error).length,8);
 assert.deepEqual(result.courts.map(c=>c.number),[1,2,3,4,5,6,7,8,9]);
});

