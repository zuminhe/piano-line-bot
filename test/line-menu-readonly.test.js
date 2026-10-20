import test from 'node:test';
import assert from 'node:assert/strict';
import {getPersonalMenuFromLine} from '../lib/line-menu-read.js';
import {saveExistingPersonalMenu} from '../lib/menu-backup-service.js';
const user='U'+'a'.repeat(32), outsider='U'+'b'.repeat(32),menu='richmenu-'+'1'.repeat(32);
const env={RICH_MENU_BACKUP_TOOLS:'enabled',RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user,LINE_CHANNEL_ACCESS_TOKEN:'fake-test-token'};
const db=()=>{const m=new Map();return {map:m,async get(k){return m.get(k)},async set(k,v,o){if(o?.nx && m.has(k))return null;m.set(k,v);return 'OK'}}};
test('backup adapter never requests LINE if disabled, non-whitelisted or token absent',async()=>{
 let count=0;const mock=async()=>{count++;throw Error('unexpected call')};
 for(const e of [{...env,RICH_MENU_BACKUP_TOOLS:''},{...env,LINE_CHANNEL_ACCESS_TOKEN:''}]){
  const r=await getPersonalMenuFromLine(user,{env:e,fetchImpl:mock});
  assert.equal(r.status,0);
 }
 assert.equal((await getPersonalMenuFromLine(outsider,{env,fetchImpl:mock})).status,0);
 assert.equal(count,0);
});
test('LINE API adapter uses only GET, exact user URL and bearer authorization',async()=>{
 let called=0;
 const fetchImpl=async(url,opts)=>{
  called++;
  assert.equal(opts.method,'GET');
  assert.equal(url,'https://api.line.me/v2/bot/user/'+user+'/richmenu');
  assert.equal(opts.headers.Authorization,'Bearer fake-test-token');
  return {status:200,async json(){return {richMenuId:menu}}};
 };
 const r=await getPersonalMenuFromLine(user,{env,fetchImpl});
 assert.deepEqual(r,{status:200,body:{richMenuId:menu}});
 assert.equal(called,1);
});
test('404 stays ambiguous and no backup occurs',async()=>{
 const storage=db();
 const result=await saveExistingPersonalMenu({userId:user,env,db:storage,
  getPersonalMenu:uid=>getPersonalMenuFromLine(uid,{env,fetchImpl:async()=>({status:404})})});
 assert.equal(result.status,'ambiguous_404');
 assert.equal(storage.map.size,0);
});
test('200 backup persists and is read back for verification',async()=>{
 const storage=db();
 const mock=async()=>({status:200,async json(){return {richMenuId:menu}}});
 const first=await saveExistingPersonalMenu({userId:user,env,db:storage,
  getPersonalMenu:uid=>getPersonalMenuFromLine(uid,{env,fetchImpl:mock})});
 assert.equal(first.status,'snapshot_saved');
 const data=JSON.parse([...storage.map.values()][0]);
 assert.equal(data.previousPersonalMenuId,menu);
 const second=await saveExistingPersonalMenu({userId:user,env,db:storage,
  getPersonalMenu:async()=>{throw Error('cannot reread existing snapshot')}});
 assert.equal(second.status,'already_saved');
});
test('browser form only adds a read-only backup action',async()=>{
 const {readFileSync}=await import('node:fs');
 const h=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 assert.match(h,/id="backupPersonalMenu"/);
 assert.match(h,/action:'backup_personal_menu'/);
 const admin=readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
 assert.match(admin,/payload.action === 'backup_personal_menu'/);
 assert.match(admin,/RICH_MENU_BACKUP_TOOLS !== 'enabled'/);
});
