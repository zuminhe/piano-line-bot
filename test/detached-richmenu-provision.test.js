import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareUnlinkedTestMenu,verifyApprovedTestImage} from '../lib/detached-richmenu-provision.js';
import {buildSingleUserTestMenu} from '../lib/rich-menu-test.js';

const user='U'+'a'.repeat(32),menuId='richmenu-'+'1'.repeat(32);
const env={
 RICH_MENU_PROVISION_MODE:'enabled', RICH_MENU_TEST_MODE:'enabled',
 RICH_MENU_TEST_USER_ID:user,LINE_LIFF_ID:'2009925919-tfNYEEmH',
 LINE_CHANNEL_ACCESS_TOKEN:'fake-only'
};
const image=Buffer.from('simulated-test-bytes');
const testOnlyValidator=()=>({status:'approved'});
const definition=buildSingleUserTestMenu(env.LINE_LIFF_ID);
function journalDb(){
 const records=new Map();
 return {records,async get(k){return records.get(k)||null},
  async set(k,v,opts){if(opts?.nx && records.has(k))return null;records.set(k,v);return 'OK'}};
}
function expectedLineResponse(requests,overrides={}) {
 return async (url,opts)=>{
  requests.push({url,opts});
  if(url.endsWith('/richmenu/list')) return {status:200,json:async()=>({richmenus:overrides.existing || []})};
  if(url.endsWith('/richmenu/validate')) return {status:200};
  if(url.endsWith('/richmenu') && opts.method==='POST'){
   return {status:overrides.createStatus??200,json:async()=>({richMenuId:menuId})};
  }
  if(url.includes('/content')) return {status:overrides.imageStatus??200};
  if(url.endsWith('/richmenu/'+menuId)) return {
   status:200,json:async()=>overrides.getMenu || definition
  };
  throw Error('Unknown route '+url);
 };
}
test('wrong file never makes requests including when allowCreate true',async()=>{
 let calls=0;
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,
 fetchImpl:async()=>{calls++;throw Error('must not call')}});
 assert.equal(result.status,'image_not_approved');
 assert.equal(verifyApprovedTestImage(Buffer.alloc(127044)).status,'image_not_approved');
 assert.equal(calls,0);
});
test('preview mode returns exact definition without requiring token or calling network',async()=>{
 let calls=0;
 const result=await prepareUnlinkedTestMenu({env:{},image,
 imageValidator:testOnlyValidator,fetchImpl:async()=>{calls++;throw Error('must not call')}});
 assert.equal(result.status,'offline_validation_ok');
 assert.deepEqual(result.definition,definition);
 assert.equal(result.definition.selected,false);
 assert.equal(result.definition.areas.length,1);
 assert.equal(calls,0);
});
test('disabled provision, wrong whitelist or missing token never use network',async()=>{
 let calls=0;
 for(const bad of [
  {...env,RICH_MENU_PROVISION_MODE:''},
  {...env,RICH_MENU_TEST_MODE:''},
  {...env,RICH_MENU_TEST_USER_ID:'Uinvalid'},
  {...env,LINE_LIFF_ID:'another'},
  {...env,LINE_CHANNEL_ACCESS_TOKEN:''}
 ]){
  const r=await prepareUnlinkedTestMenu({env:bad,image,imageValidator:testOnlyValidator,
   allowCreate:true,fetchImpl:async()=>{calls++;throw Error('must not call')}});
  assert.notEqual(r.status,'detached_test_menu_created_image_uploaded');
 }
 assert.equal(calls,0);
});
test('creates & uploads ONLY detached test menu, never links a user or sets global default',async()=>{
 const requests=[];
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:journalDb(),
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests)});
 assert.deepEqual(result,{status:'detached_test_menu_created_image_uploaded',richMenuId:menuId});
 assert.deepEqual(requests.map(x=>x.opts.method),['GET','POST','POST','POST','GET']);
 assert.ok(requests.every(x=>!x.url.includes('/user/')));
 assert.ok(requests.every(x=>!x.url.includes('/user/all/')));
 assert.ok(requests.every(x=>x.opts.method!=='DELETE'));
 assert.equal(requests[3].url,'https://api-data.line.me/v2/bot/richmenu/'+menuId+'/content');
 assert.equal(requests[3].opts.headers['Content-Type'],'image/png');
 assert.equal(requests[3].opts.body,image);
 const json=JSON.parse(requests[2].opts.body);
 assert.equal(json.selected,false);
 assert.deepEqual(json.areas,definition.areas);
});
test('duplicate definition halts before creating new menu',async()=>{
 const requests=[];
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:journalDb(),
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests,{
   existing:[{richMenuId:menuId,name:definition.name}]
  })});
 assert.equal(result.status,'test_menu_already_exists_review_first');
 assert.equal(requests.length,1);
});
test('creation result uncertain never triggers upload or automatic retry',async()=>{
 const requests=[];
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:journalDb(),
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests,{createStatus:500})});
 assert.equal(result.status,'creation_result_unknown_do_not_retry');
 assert.equal(requests.length,3);
});
test('image upload failure returns created menu ID but does not link anyone',async()=>{
 const requests=[];
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:journalDb(),
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests,{imageStatus:503})});
 assert.deepEqual(result,{status:'created_but_image_unverified_do_not_retry',richMenuId:menuId});
 assert.equal(requests.length,4);
});
test('definition read-back mismatch refuses claiming success',async()=>{
 const requests=[];
 const wrong={...definition,selected:true};
 const result=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:journalDb(),
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests,{getMenu:wrong})});
 assert.equal(result.status,'created_but_definition_unverified_do_not_link');
 assert.equal(result.richMenuId,menuId);
});

test('durable provision journal prevents second creation after first attempt',async()=>{
 const records=journalDb(),requests=[];
 const first=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:records,
  imageValidator:testOnlyValidator,fetchImpl:expectedLineResponse(requests)});
 assert.equal(first.status,'detached_test_menu_created_image_uploaded');
 assert.equal(records.records.size,1);
 const current=[...records.records.values()][0];
 assert.equal(JSON.parse(current).status,'image_uploaded_definition_verified');
 const second=await prepareUnlinkedTestMenu({env,image,allowCreate:true,db:records,
  imageValidator:testOnlyValidator,fetchImpl:async()=>{throw Error('should not call')}});
 assert.equal(second.status,'existing_provision_attempt_manual_review');
 assert.equal(requests.filter(x=>x.url.endsWith('/richmenu')&&x.opts.method==='POST').length,1);
});
