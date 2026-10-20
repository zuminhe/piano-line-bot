import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectMenuRecovery} from '../lib/menu-recovery-inspector.js';
const user='U'+'a'.repeat(32),outsider='U'+'b'.repeat(32);
const original='richmenu-'+'1'.repeat(32),testMenu='richmenu-'+'2'.repeat(32);
const env={RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user,
 RICH_MENU_TEST_MENU_ID:testMenu,RICH_MENU_RECOVERY_INSPECTION:'enabled'};
const suffix=createHash('sha256').update(user).digest('hex');
function db(){
 const rows=new Map([
  ['richmenu:test:journal:v1:'+suffix,JSON.stringify({userId:user,previousPersonalMenuId:original,testMenuId:testMenu,phase:'activation_pending'})],
  ['richmenu:original:v1:'+suffix,JSON.stringify({userId:user,previousPersonalMenuId:original})],
  ['richmenu:test:lock:v1:'+suffix,'SECRET_LOCK_TOKEN_DO_NOT_EXPOSE']
 ]);
 let reads=0;
 return {get reads(){return reads},async get(k){reads++;return rows.get(k)},rows};
}
test('unauthorized recovery inspection reads neither DB nor LINE',async()=>{
 const data=db();let lineReads=0;const reader=async()=>{lineReads++;return {status:200,body:{richMenuId:original}}};
 assert.equal((await inspectMenuRecovery({userId:user,env:{...env,RICH_MENU_RECOVERY_INSPECTION:''},db:data,getPersonalMenu:reader})).status,'recovery_inspection_disabled');
 assert.equal((await inspectMenuRecovery({userId:outsider,env,db:data,getPersonalMenu:reader})).status,'not_allowed');
 assert.equal(data.reads,0);assert.equal(lineReads,0);
});
test('inspection returns lock existence, not lock token, and never writes',async()=>{
 const data=db();
 const got=await inspectMenuRecovery({userId:user,env,db:data,
 getPersonalMenu:async()=>({status:200,body:{richMenuId:testMenu}})});
 assert.equal(got.status,'test_menu_current_manual_restore_review');
 assert.equal(got.lockPresent,true);
 assert.equal(JSON.stringify(got).includes('SECRET_LOCK_TOKEN_DO_NOT_EXPOSE'),false);
});
test('without lock, original menu returns safe read-only status',async()=>{
 const data=db();data.rows.delete('richmenu:test:lock:v1:'+suffix);
 const got=await inspectMenuRecovery({userId:user,env,db:data,
 getPersonalMenu:async()=>({status:200,body:{richMenuId:original}})});
 assert.equal(got.status,'original_current_no_write_needed');
 assert.equal(got.lockPresent,false);
});
test('admin recovery action has an early disabled gate and no manual unlock command',()=>{
 const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
 assert.match(html,/id="inspectMenuRecovery"/);
 assert.match(html,/action:'inspect_menu_recovery'/);
 assert.match(backend,/payload.action === 'inspect_menu_recovery'/);
 assert.match(backend,/RICH_MENU_RECOVERY_INSPECTION !== 'enabled'/);
 assert.doesNotMatch(html,/action:'unlock_menu'/);
 assert.doesNotMatch(backend,/payload.action === 'unlock_menu'/);
});
