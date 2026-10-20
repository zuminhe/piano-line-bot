import test from 'node:test';
import assert from 'node:assert/strict';
import {menuWritePermission, menuIdForAccess} from '../lib/menu-safety.js';
import {syncRichMenu} from '../lib/line.js';

const user='U'+'a'.repeat(32);
const other='U'+'b'.repeat(32);
const menu='richmenu-'+'1'.repeat(32);
const environment={RICH_MENU_TEST_MODE:'enabled',RICH_MENU_TEST_USER_ID:user,RICH_MENU_MEMBER:menu};

test('rich menu writes are opt-in even with a token and valid user',()=>{
 assert.equal(menuWritePermission(user,{...environment,RICH_MENU_TEST_MODE:undefined,LINE_CHANNEL_ACCESS_TOKEN:'secret'}),'disabled');
 assert.equal(menuWritePermission(user,{...environment,RICH_MENU_TEST_MODE:'true'}),'disabled');
});
test('only the exact single LINE user ID is allowed',()=>{
 assert.equal(menuWritePermission(user,environment),'allowed');
 assert.equal(menuWritePermission(other,environment),'not_allowed');
 assert.equal(menuWritePermission(user,{...environment,RICH_MENU_TEST_USER_ID:'*'}),'test_user_not_configured');
 assert.equal(menuWritePermission(user,{...environment,RICH_MENU_TEST_USER_ID:user+','+other}),'test_user_not_configured');
 assert.equal(menuWritePermission(user,{...environment,RICH_MENU_TEST_USER_ID:'Uinvalid'}),'test_user_not_configured');
});
test('missing guest menu never unlinks any existing user menu',()=>{
 assert.deepEqual(menuIdForAccess({hasCourse:false,coaching:false},environment),{status:'not_configured'});
 assert.deepEqual(menuIdForAccess({hasCourse:true,coaching:false},environment),{status:'ready',id:menu});
});
test('reject invalid and non-API rich menu IDs',()=>{
 assert.equal(menuIdForAccess({hasCourse:true,coaching:false},{...environment,RICH_MENU_MEMBER:'wrong'}).status,'invalid_menu_id');
 assert.equal(menuIdForAccess({hasCourse:true,coaching:false},{...environment,RICH_MENU_MEMBER:'richmenu-xyz'}).status,'invalid_menu_id');
});
test('disabled sync and non-whitelisted sync never attempt a network call', async()=>{
 const original={...process.env};
 const previousFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls++;throw Error('must not call network')};
 try{
  process.env.LINE_CHANNEL_ACCESS_TOKEN='test-only';
  process.env.RICH_MENU_TEST_USER_ID=user;
  process.env.RICH_MENU_MEMBER=menu;
  delete process.env.RICH_MENU_TEST_MODE;
  assert.equal((await syncRichMenu(user,{hasCourse:true,coaching:false})).status,'disabled');
  process.env.RICH_MENU_TEST_MODE='enabled';
  assert.equal((await syncRichMenu(other,{hasCourse:true,coaching:false})).status,'not_allowed');
  assert.equal((await syncRichMenu(user,{hasCourse:false,coaching:false})).status,'not_configured');
  assert.equal(calls,0);
 }finally{
  globalThis.fetch=previousFetch;
  for(const key of ['LINE_CHANNEL_ACCESS_TOKEN','RICH_MENU_TEST_USER_ID','RICH_MENU_MEMBER','RICH_MENU_TEST_MODE']){
   if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];
  }
 }
});
