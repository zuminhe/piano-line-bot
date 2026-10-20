import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPersonalMenuResponse,prepareOriginalMenuSnapshot,planRestoration} from '../lib/menu-restore-guard.js';
const user='U'+'a'.repeat(32), other='U'+'b'.repeat(32);
const original='richmenu-'+'1'.repeat(32),testMenu='richmenu-'+'2'.repeat(32);
const validResponse={status:200,body:{richMenuId:testMenu}};
test('200 with valid menu ID confirms personal menu',()=>{
 assert.deepEqual(inspectPersonalMenuResponse(200,{richMenuId:original}),{status:'confirmed_existing',richMenuId:original});
});
test('404 is always ambiguous, never automatically interpreted as no linked menu',()=>{
 assert.equal(inspectPersonalMenuResponse(404,{}).status,'ambiguous_404');
 assert.equal(inspectPersonalMenuResponse(403,{}).status,'unverified');
 assert.equal(inspectPersonalMenuResponse(200,{richMenuId:'bad'}).status,'unverified');
});
test('only verified existing personal menu permits snapshot preparation',()=>{
 assert.equal(prepareOriginalMenuSnapshot({userId:user,readResult:inspectPersonalMenuResponse(404,{})}).status,'refuse_snapshot');
 assert.equal(prepareOriginalMenuSnapshot({userId:'bad',readResult:inspectPersonalMenuResponse(200,{richMenuId:original})}).status,'refuse_snapshot');
 const result=prepareOriginalMenuSnapshot({userId:user,readResult:inspectPersonalMenuResponse(200,{richMenuId:original}),createdAt:'2026-10-20T15:00:00Z'});
 assert.equal(result.status,'prepared');
 assert.equal(result.snapshot.previousPersonalMenuId,original);
});
test('restore only if the test menu is still currently linked to the same user',()=>{
 const snapshot=prepareOriginalMenuSnapshot({userId:user,readResult:inspectPersonalMenuResponse(200,{richMenuId:original}),createdAt:'2026-10-20T15:00:00Z'}).snapshot;
 assert.deepEqual(planRestoration({snapshot,actualUserId:user,currentMenuResponse:validResponse,ownTestMenuId:testMenu}),
 {status:'ready_to_relink_original',userId:user,richMenuId:original});
 for(const current of [
  {status:200,body:{richMenuId:original}},
  {status:404,body:{}},
  {status:503,body:{}}
 ]){
  assert.equal(planRestoration({snapshot,actualUserId:user,currentMenuResponse:current,ownTestMenuId:testMenu}).status,'refuse_restore');
 }
 assert.equal(planRestoration({snapshot,actualUserId:other,currentMenuResponse:validResponse,ownTestMenuId:testMenu}).status,'refuse_restore');
 assert.equal(planRestoration({snapshot:{...snapshot,previousPersonalMenuId:'invalid'},actualUserId:user,currentMenuResponse:validResponse,ownTestMenuId:testMenu}).status,'refuse_restore');
});
