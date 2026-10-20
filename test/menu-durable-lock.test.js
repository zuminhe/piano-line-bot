import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildSingleUserTestMenu} from '../lib/rich-menu-test.js';
import {switchToSingleUserTestMenu,restoreSingleUserOriginalMenu} from '../lib/menu-switch-service.js';
const user='U'+'a'.repeat(32);
const old='richmenu-'+'1'.repeat(32),fresh='richmenu-'+'2'.repeat(32);
const env={RICH_MENU_SWITCH_TOOLS:'enabled',RICH_MENU_RESTORE_TOOLS:'enabled',
 RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user,RICH_MENU_TEST_MENU_ID:fresh,
 LINE_LIFF_ID:'2009925919-tfNYEEmH',LINE_CHANNEL_ACCESS_TOKEN:'fake-only'};
const hash=createHash('sha256').update(user).digest('hex');
const backup='richmenu:original:v1:'+hash, lock='richmenu:test:lock:v1:'+hash;
function store(){
 const m=new Map(),opts=[];
 m.set(backup,JSON.stringify({schemaVersion:1,source:'line_per_user_get_200',userId:user,previousPersonalMenuId:old}));
 return {m,opts,async get(k){return m.get(k)||null},
 async set(k,v,o){opts.push(o);if(o?.nx && m.has(k))return null;m.set(k,v);return 'OK'},
 async eval(_,keys,args){if(m.get(keys[0])===args[0]){m.delete(keys[0]);return 1}return 0}};
}
function line(){
 let linked=old;
 return {get linked(){return linked},set linked(v){linked=v},
  async getPersonalMenu(){return {status:200,body:{richMenuId:linked}}},
  async getRichMenu(){return {status:200,body:buildSingleUserTestMenu(env.LINE_LIFF_ID)}},
  async hasRichMenuImage(){return true},
  async linkPersonalMenu(_user,id){linked=id;return {status:200}}
 };
}
test('normal activation releases durable lock without ever creating expiring mutex',async()=>{
 const db=store(),api=line();
 const result=await switchToSingleUserTestMenu({userId:user,env,db,line:api});
 assert.equal(result.status,'test_menu_active');
 assert.equal(db.m.has(lock),false);
 const mutexWrite=db.opts.find(o=>o?.nx && !o?.ex);
 assert.ok(mutexWrite);
 assert.equal(db.opts.some(o=>o?.ex!==undefined),false);
});
test('unknown LINE outcome retains durable lock and rejects all subsequent mutations',async()=>{
 const db=store(),api=line();
 api.linkPersonalMenu=async(_,id)=>{api.linked=id;throw Error('timeout after remote write')};
 const first=await switchToSingleUserTestMenu({userId:user,env,db,line:api});
 assert.equal(first.status,'activation_result_unknown_restore_may_be_needed');
 assert.equal(db.m.has(lock),true);
 assert.equal((await restoreSingleUserOriginalMenu({userId:user,env,db,line:api})).status,'another_operation_in_progress_or_recovery_required');
 assert.equal((await switchToSingleUserTestMenu({userId:user,env,db,line:api})).status,'another_operation_in_progress_or_recovery_required');
});
test('unexpected exception retains lock even without a successful external POST',async()=>{
 const db=store(),api=line();
 api.getRichMenu=async()=>{throw Error('provider failure')};
 const result=await switchToSingleUserTestMenu({userId:user,env,db,line:api});
 assert.equal(result.status,'unexpected_failure_manual_recovery_required');
 assert.equal(db.m.has(lock),true);
});
