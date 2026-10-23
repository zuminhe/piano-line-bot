import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const css=html=>html.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
for(const file of ['sales-preview.html','student.html']){
 test(file+' uses standard readable Traditional Chinese typography',()=>{
  const html=src(file),style=css(html);
  assert.match(html,/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+TC:wght@400;500;600;700/);
  assert.match(style,/font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei"/);
  assert.match(style,/PIANO LESSONS typography v2/);
  assert.match(style,/font-synthesis:none/);
  assert.match(style,/font-size:18px/);
  assert.match(style,/@media\(max-width:360px\)/);
  const overrides=style.split('/* --- PIANO LESSONS typography v2:')[1];
  assert.ok(overrides);
  assert.doesNotMatch(overrides,/font-weight:\s*(750|780|800|850|900)/);
 });
}
test('sales hero, buttons, prices, descriptions grow while checkout stays off',()=>{
 const html=src('sales-preview.html'),style=css(html);
 assert.match(style,/\.navlinks\{font-size:17px/);
 assert.match(style,/\.hero h1\{font-size:clamp\(40px,4\.35vw,64px\);font-weight:700/);
 assert.match(style,/\.option \.money\{font-size:clamp\(31px,2\.35vw,37px\);font-weight:700/);
 assert.match(style,/\.option \.contents\{font-size:16px/);
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/尚未開放購買/);
});
test('student controls and tablet/mobile responsive typography remain available',()=>{
 const html=src('student.html'),style=css(html);
 assert.match(style,/\.card h2\{font-size:clamp\(25px,2\.3vw,31px\);font-weight:600/);
 assert.match(style,/\.lesson strong\{font-size:20px;font-weight:600/);
 assert.match(style,/\.playlist a\{font-size:16px/);
 assert.match(style,/@media\(min-width:768px\)/);
 assert.match(html,/id="completeLesson"/);
 assert.match(html,/id="lessonVideo"/);
 assert.match(html,/\/api\/student\/progress/);
});
