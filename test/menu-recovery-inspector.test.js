import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectMenuRecovery} from '../lib/menu-recovery-inspector.js';

const user='U'+'a'.repeat(32),other='U'+'b'.repeat(32);
const original='richmenu-'+'1'.repeat(32),fresh='richmenu-'+'2'.repeat(32);
const env={RICH_MENU_RECOVERY_INSPECTION:'enabled',RICH_MENU_TEST_MODE:'enabled',
 RICH_MENU_TEST_USER_ID:user,RICH_MENU_TEST_MENU_ID:fresh};
const h=createHash('sha256').update(user).digest('hex');
const memory=new Map([
 ['richmenu:original:v1:'+h,JSON.stringify({userId:user,previousPersonalMenuId:original})],
 ['richmenu:test:journal:v1:'+h,JSON.stringify({userId:user,
  previousPersonalMenuId:original,testMenuId:fresh,phase:'activation_pending'})]
]);
const db={async get(k){return memory.get(k)}};
const lineWith=id=>async()=>({status:200,body:{richMenuId:id}});
test('disabled and non-allowlisted recovery inspectors never query LINE',async()=>{
 let count=0;const get=async()=>{count++;throw Error('should not query')};
 assert.equal((await inspectMenuRecovery({userId:user,env:{...env,RICH_MENU_RECOVERY_INSPECTION:''},db,getPersonalMenu:get})).status,'recovery_inspection_disabled');
 assert.equal((await inspectMenuRecovery({userId:other,env,db,getPersonalMenu:get})).status,'not_allowed');
 assert.equal(count,0);
});
test('inspection classifies previous, test, and unexpected menus without writes',async()=>{
 const run=async id=>(await inspectMenuRecovery({userId:user,env,db,getPersonalMenu:lineWith(id)})).status;
 assert.equal(await run(original),'original_current_no_write_needed');
 assert.equal(await run(fresh),'test_menu_current_manual_restore_review');
 assert.equal(await run('richmenu-'+'3'.repeat(32)),'unexpected_menu_current_do_not_overwrite');
});
test('404 and incomplete journals refuse any recovery recommendation',async()=>{
 assert.equal((await inspectMenuRecovery({userId:user,env,db,getPersonalMenu:async()=>({status:404})})).status,'line_status_unknown');
 const bad={async get(k){const value=await db.get(k);return k.includes('journal')?JSON.stringify({...JSON.parse(value),testMenuId:'wrong'}):value}};
 assert.equal((await inspectMenuRecovery({userId:user,env,db:bad,getPersonalMenu:lineWith(fresh)})).status,'recovery_record_unverified');
});
