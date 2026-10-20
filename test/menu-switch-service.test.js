import test from 'node:test';
import assert from 'node:assert/strict';
import {switchToSingleUserTestMenu,restoreSingleUserOriginalMenu} from '../lib/menu-switch-service.js';
const user='U'+'a'.repeat(32), outsider='U'+'b'.repeat(32);
const old='richmenu-'+'1'.repeat(32),fresh='richmenu-'+'2'.repeat(32);
const liffId='2009925919-tfNYEEmH';
const env={RICH_MENU_SWITCH_TOOLS:'enabled',RICH_MENU_RESTORE_TOOLS:'enabled',
 RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user, RICH_MENU_TEST_MENU_ID:fresh,
 LINE_LIFF_ID:liffId,LINE_CHANNEL_ACCESS_TOKEN:'fake-test-only'};
const backupKey=uid=>'richmenu:original:v1:'+createHash('sha256').update(uid).digest('hex');
import {createHash} from 'node:crypto';
import {buildSingleUserTestMenu} from '../lib/rich-menu-test.js';
const originalSnapshot=()=>({schemaVersion:1,userId:user,
 previousPersonalMenuId:old,source:'line_per_user_get_200',createdAt:new Date().toISOString()});
function store(){
 const m=new Map(),locks=new Map();
 return {m,
 async get(k){return m.get(k)||null},
 async set(k,v,opts){
  if(opts?.nx && m.has(k))return null;
  m.set(k,v);return 'OK';
 },
 async eval(_script,keys,args){if(m.get(keys[0])===args[0]){m.delete(keys[0]);return 1}return 0},
 async init(){m.set(backupKey(user),JSON.stringify(originalSnapshot()))}
 };
}
function fakeLine(){
 let linked=old,linkedCount=0;
 return {
  get linked(){return linked},set linked(v){linked=v},get linkedCount(){return linkedCount},
  async getPersonalMenu(){return {status:200,body:{richMenuId:linked}}},
  async getRichMenu(){return {status:200,body:buildSingleUserTestMenu(liffId)}},
  async hasRichMenuImage(){return true},
  async linkPersonalMenu(uid,id){assert.equal(uid,user);linkedCount++;linked=id;return {status:200}}
 };
}
test('missing gates and outsider fail closed without LINE changes',async()=>{
 const db=store();await db.init();const line=fakeLine();
 assert.equal((await switchToSingleUserTestMenu({userId:user,env:{...env,RICH_MENU_SWITCH_TOOLS:''},db,line})).status,'operation_disabled');
 assert.equal((await switchToSingleUserTestMenu({userId:outsider,env,db,line})).status,'not_allowed');
 assert.equal(line.linkedCount,0);
});
test('successful activation and restoration only for exact allowlisted user',async()=>{
 const db=store();await db.init();const line=fakeLine();
 assert.equal((await switchToSingleUserTestMenu({userId:user,env,db,line})).status,'test_menu_active');
 assert.equal(line.linked,fresh);
 assert.equal((await restoreSingleUserOriginalMenu({userId:user,env,db,line})).status,'original_menu_restored');
 assert.equal(line.linked,old);
 assert.equal((await restoreSingleUserOriginalMenu({userId:user,env,db,line})).status,'restore_refused_missing_or_changed_state');
 assert.equal(line.linkedCount,2);
});
test('block stale original menu, missing image and unexpected menu layout',async()=>{
 for(const variant of ['old_changed','no_image','layout_changed']){
  const db=store();await db.init();const line=fakeLine();
  if(variant==='old_changed')line.linked='richmenu-'+'3'.repeat(32);
  if(variant==='no_image')line.hasRichMenuImage=async()=>false;
  if(variant==='layout_changed')line.getRichMenu=async()=>({status:200,body:{...buildSingleUserTestMenu(liffId),areas:[]}});
  const result=await switchToSingleUserTestMenu({userId:user,env,db,line});
  assert.notEqual(result.status,'test_menu_active');
  assert.equal(line.linkedCount,0);
 }
});
test('after uncertain activation failure, original snapshot remains and restore checks actual menu',async()=>{
 const db=store();await db.init();const line=fakeLine();
 line.linkPersonalMenu=async(_,id)=>{line.linked=id;throw Error('network timeout after LINE accepted change')};
 const result=await switchToSingleUserTestMenu({userId:user,env,db,line});
 assert.equal(result.status,'activation_result_unknown_restore_may_be_needed');
 assert.equal(line.linked,fresh);
 assert.equal(JSON.parse(db.m.get(backupKey(user))).previousPersonalMenuId,old);
 line.linkPersonalMenu=async(_,id)=>{line.linked=id;return {status:200}};
 // Quarantine unknown external results: a human must inspect before any write.
 assert.equal((await restoreSingleUserOriginalMenu({userId:user,env,db,line})).status,'another_operation_in_progress_or_recovery_required');
 assert.equal(line.linked,fresh);
});
test('refuse rollback if another operator changed current menu',async()=>{
 const db=store();await db.init();const line=fakeLine();
 assert.equal((await switchToSingleUserTestMenu({userId:user,env,db,line})).status,'test_menu_active');
 line.linked='richmenu-'+'4'.repeat(32);
 assert.equal((await restoreSingleUserOriginalMenu({userId:user,env,db,line})).status,'restore_refused_menu_changed_or_unverified');
 assert.equal(line.linkedCount,1);
});
