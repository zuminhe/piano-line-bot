import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSingleUserTestMenu} from '../lib/rich-menu-test.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const asset=json('../assets/richmenu-six-cell-test-manifest.json');
const definition=json('../assets/richmenu-six-cell-test-definition.json');

test('approved design is valid 2500x1686 LINE PNG within 1 MB',()=>{
 assert.equal(asset.mimeType,'image/png');
 assert.equal(asset.width,2500);
 assert.equal(asset.height,1686);
 assert.ok(asset.width/asset.height>=1.45);
 assert.ok(asset.fileBytes>0 && asset.fileBytes<=1024*1024);
 assert.match(asset.sha256,/^[a-f0-9]{64}$/);
 assert.equal(asset.inactiveCells,5);
});
test('only visible blue upper-left tile opens the exact staging LIFF',()=>{
 const active=asset.actionCell;
 const menu=buildSingleUserTestMenu('2009925919-tfNYEEmH');
 assert.deepEqual(menu,definition);
 assert.equal(menu.areas.length,1);
 assert.deepEqual(menu.areas[0].bounds,active);
 assert.deepEqual(active,{x:0,y:0,width:833,height:843});
 assert.equal(menu.areas[0].action.type,'uri');
 assert.equal(menu.areas[0].action.label,'我的課程');
 assert.equal(menu.areas[0].action.uri,'https://liff.line.me/2009925919-tfNYEEmH');
 assert.equal(menu.selected,false);
});
test('six visual cells exactly partition the image with no extra click actions',()=>{
 const cols=asset.visualCellColumns,rows=asset.visualCellRows;
 assert.deepEqual(cols,[0,833,1666,2500]);
 assert.deepEqual(rows,[0,843,1686]);
 assert.equal((cols.length-1)*(rows.length-1),6);
 assert.ok(cols.every((v,i)=>i===0 || v>cols[i-1]));
 assert.ok(rows.every((v,i)=>i===0 || v>rows[i-1]));
 for(const area of definition.areas){
  assert.ok(area.bounds.x>=0 && area.bounds.y>=0);
  assert.ok(area.bounds.x+area.bounds.width<=asset.width);
  assert.ok(area.bounds.y+area.bounds.height<=asset.height);
 }
 assert.equal(definition.areas.length,6-asset.inactiveCells);
});
test('repository contains an offline renderer; no image upload or default-menu mutation invoked',()=>{
 const renderer=readFileSync(new URL('../scripts/generate-richmenu-test-image.py',import.meta.url),'utf8');
 assert.match(renderer,/Image\.new\('RGB',\(W,H\)/);
 assert.match(renderer,/im\.save\(outfile,optimize=True/);
 assert.doesNotMatch(renderer,/api\.line\.me|api-data\.line\.me|POST |DELETE /);
});
