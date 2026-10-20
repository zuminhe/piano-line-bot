import test from 'node:test';
import assert from 'node:assert/strict';
import {saveExistingPersonalMenu} from '../lib/menu-backup-service.js';
const user='U'+'a'.repeat(32), other='U'+'b'.repeat(32);
const menu='richmenu-'+'1'.repeat(32);
const env={RICH_MENU_BACKUP_TOOLS:'enabled',RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user};
function memoryDb(){
 const records=new Map();
 return {records,async get(key){return records.get(key)},async set(key,value,opts){
  if(opts?.nx && records.has(key))return null;
  records.set(key,value);return 'OK';
 }};
}
test('disabled backup cannot request LINE data',async()=>{
 let calls=0;
 const result=await saveExistingPersonalMenu({userId:user,env:{...env,RICH_MENU_BACKUP_TOOLS:undefined},
 db:memoryDb(),getPersonalMenu:async()=>{calls++;return {status:200,body:{richMenuId:menu}}}});
 assert.equal(result.status,'backup_tools_disabled');assert.equal(calls,0);
});
test('wrong user cannot read or save snapshots',async()=>{
 let calls=0;const db=memoryDb();
 const result=await saveExistingPersonalMenu({userId:other,env,db,getPersonalMenu:async()=>{calls++;return {status:200,body:{richMenuId:menu}}}});
 assert.equal(result.status,'not_allowed');assert.equal(calls,0);assert.equal(db.records.size,0);
});
test('404 is ambiguous and never saved as empty menu',async()=>{
 const db=memoryDb();
 const result=await saveExistingPersonalMenu({userId:user,env,db,getPersonalMenu:async()=>({status:404,body:{}})});
 assert.equal(result.status,'ambiguous_404');assert.equal(db.records.size,0);
});
test('valid personal menu snapshot saved once only',async()=>{
 const db=memoryDb();let calls=0;
 const getPersonalMenu=async()=>{calls++;return {status:200,body:{richMenuId:menu}}};
 const first=await saveExistingPersonalMenu({userId:user,env,db,getPersonalMenu});
 const second=await saveExistingPersonalMenu({userId:user,env,db,getPersonalMenu});
 assert.equal(first.status,'snapshot_saved');assert.equal(second.status,'already_saved');
 assert.equal(calls,1);assert.equal(db.records.size,1);
 const snapshot=JSON.parse([...db.records.values()][0]);
 assert.equal(snapshot.userId,user);assert.equal(snapshot.previousPersonalMenuId,menu);
});
