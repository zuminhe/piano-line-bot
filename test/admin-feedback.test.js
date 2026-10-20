import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
test('rich menu sync has inline accessible status area',()=>{
 assert.match(html,/id="menuSyncStatus"[^>]*role="status"/);
 assert.match(html,/const feedback=\$\('menuSyncStatus'\)/);
});
test('blocked responses and success are labelled distinctly',()=>{
 for(const status of ['disabled','not_allowed','test_user_not_configured','not_configured','invalid_menu_id','linked']){
  assert.match(html,new RegExp('\\b'+status+':\\['));
 }
 assert.match(html,/同步請求失敗/);
 assert.match(html,/未知同步結果/);
});
test('sync click handler does not use run wrapper that overwrites its result',()=>{
 assert.match(html,/\$\('sync'\)\.onclick=async\(\)=>/);
 assert.doesNotMatch(html,/\$\('sync'\)\.onclick=\(\)=>run\(/);
});
