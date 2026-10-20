import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestMenuLineAdapter} from '../lib/line-menu-switch-adapter.js';

const user='U'+'a'.repeat(32), outsider='U'+'b'.repeat(32);
const testId='richmenu-'+'1'.repeat(32),originalId='richmenu-'+'2'.repeat(32);
const env={RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user,
 RICH_MENU_TEST_MENU_ID:testId,LINE_CHANNEL_ACCESS_TOKEN:'fake-test-token',
 RICH_MENU_SWITCH_TOOLS:'enabled',RICH_MENU_RESTORE_TOOLS:'enabled'};
test('adapter can only read allowlisted user and known test menu',async()=>{
 const requests=[];
 const adapter=createTestMenuLineAdapter({env,fetchImpl:async(url,opts)=>{
  requests.push({url,opts});return {status:200,json:async()=>({richMenuId:originalId})}
 }});
 assert.equal((await adapter.getPersonalMenu(outsider)).reason,'not_allowed');
 assert.equal((await adapter.getRichMenu(originalId)).reason,'test_menu_not_configured');
 assert.equal((await adapter.getPersonalMenu(user)).status,200);
 assert.equal(requests.length,1);
 assert.equal(requests[0].opts.method,'GET');
});
test('disabled switches and arbitrary menu IDs never send POST',async()=>{
 let count=0;
 const adapter=createTestMenuLineAdapter({env:{...env,RICH_MENU_SWITCH_TOOLS:''},
  permittedRestoreMenuId:originalId,fetchImpl:async()=>{count++;return {status:200}}});
 assert.equal((await adapter.linkPersonalMenu(user,testId)).reason,'operation_disabled');
 assert.equal((await adapter.linkPersonalMenu(outsider,testId)).reason,'not_allowed');
 assert.equal((await adapter.linkPersonalMenu(user,'richmenu-'+'3'.repeat(32))).reason,'target_menu_not_permitted');
 assert.equal(count,0);
});
test('only exact test/known previous menu permits POST with separately enabled gates',async()=>{
 const calls=[];
 const adapter=createTestMenuLineAdapter({env,permittedRestoreMenuId:originalId,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});return {status:200};
 }});
 assert.equal((await adapter.linkPersonalMenu(user,testId)).status,200);
 assert.equal((await adapter.linkPersonalMenu(user,originalId)).status,200);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.opts.method==='POST' && c.url.includes('/user/'+user+'/richmenu/')));
});
test('image exists only for 200 and image content-type',async()=>{
 const get=type=>createTestMenuLineAdapter({env,fetchImpl:async()=>({
  status:200,headers:{get:()=>type},body:{cancel:async()=>{}}
 })});
 assert.equal(await get('image/png').hasRichMenuImage(testId),true);
 assert.equal(await get('image/jpeg; charset=binary').hasRichMenuImage(testId),true);
 assert.equal(await get('text/html').hasRichMenuImage(testId),false);
});
test('without token or test mode, no request of any method can execute',async()=>{
 let requests=0;
 for(const invalid of [{...env,RICH_MENU_TEST_MODE:''},{...env,LINE_CHANNEL_ACCESS_TOKEN:''}]){
  const adapter=createTestMenuLineAdapter({env:invalid,fetchImpl:async()=>{
   requests++;throw Error('forbidden');
  }});
  await adapter.getPersonalMenu(user);
  await adapter.getRichMenu(testId);
  await adapter.hasRichMenuImage(testId);
  await adapter.linkPersonalMenu(user,testId);
 }
 assert.equal(requests,0);
});
