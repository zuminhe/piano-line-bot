import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, effectiveAccess, validateGrant, validLineId } from '../lib/access.js';
test('full, basic and advanced grants accumulate', () => {
  const basic = { entitlements: PLANS.course_basic.entitlements, status:'active' };
  const advanced = { entitlements:PLANS.course_advanced.entitlements, status:'active' };
  assert.deepEqual(effectiveAccess([basic, advanced]).units,[1,2,3,4]);
});
test('expired and revoked grants never confer access', () => {
  const now=Date.parse('2026-10-20T00:00:00Z');
  const grants=[
    { entitlements:['coaching'],expiresAt:'2026-10-19T00:00:00Z',status:'active' },
    { entitlements:['unit:1'],status:'revoked' }
  ];
  assert.deepEqual(effectiveAccess(grants,now),{units:[],coaching:false,hasCourse:false});
});
test('subscription requires expiry',()=>assert.throws(()=>validateGrant('coaching_month',null)));
test('unknown plan is never accepted',()=>assert.throws(()=>validateGrant('untrusted',null)));
test('only LINE user IDs of correct shape accepted',()=>{
  assert.equal(validLineId('U'+'a'.repeat(32)),true);
  assert.equal(validLineId('Uinvalid'),false);
});
