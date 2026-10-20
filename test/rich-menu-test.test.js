import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSingleUserTestMenu,restoreIntent} from '../lib/rich-menu-test.js';

test('six-cell test menu has only a single actionable area',()=>{
 const menu=buildSingleUserTestMenu('2009925919-tfNYEEmH');
 assert.equal(menu.size.width,2500);
 assert.equal(menu.size.height,1686);
 assert.equal(menu.selected,false);
 assert.equal(menu.areas.length,1);
 assert.deepEqual(menu.areas[0].bounds,{x:0,y:0,width:833,height:843});
 assert.equal(menu.areas[0].action.uri,'https://liff.line.me/2009925919-tfNYEEmH');
 assert.equal(menu.areas[0].action.type,'uri');
});
test('refuses arbitrary or malformed LIFF IDs',()=>{
 for(const value of ['',null,'javascript:alert(1)','https://example.com','2009925919-abc?param=x']){
  assert.throws(()=>buildSingleUserTestMenu(value));
 }
});
test('returning to old personal rich menu never treats missing ID as arbitrary target',()=>{
 const old='richmenu-'+'a'.repeat(32);
 assert.deepEqual(restoreIntent(old),{action:'relink_previous_menu',richMenuId:old});
 assert.deepEqual(restoreIntent(null),{action:'unlink_test_menu'});
 assert.deepEqual(restoreIntent(''),{action:'refuse_unsafe_restore'});
 assert.deepEqual(restoreIntent('richmenu-typo'),{action:'refuse_unsafe_restore'});
});
