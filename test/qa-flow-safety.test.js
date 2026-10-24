import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const student=readFileSync(new URL('../student.html',import.meta.url),'utf8');
const admin=readFileSync(new URL('../admin.html',import.meta.url),'utf8');

function section(source,start,end){
 const a=source.indexOf(start);
 assert.notEqual(a,-1,'Missing start anchor: '+start);
 const b=source.indexOf(end,a+start.length);
 assert.notEqual(b,-1,'Missing end anchor: '+end);
 return source.slice(a,b);
}

test('unpublished or unplayable lessons truly hide completion panel even under flex CSS',()=>{
 assert.match(student,/<div class="complete-panel" id="completionPanel" hidden>/);
 assert.match(student,/\.complete-panel\[hidden\]\{display:none!important\}/);
 assert.match(student,/\$\('completionPanel'\)\.hidden=!lessonPlayable/);
});

test('late progress POST responses cannot overwrite a subsequently selected lesson',()=>{
 const action=section(student,'completeButton.onclick=async()=>{','\n    };');
 assert.match(action,/const body=await r\.json\(\)\.catch\(\(\)=>\(\{\}\)\);\s*\/\/[^\n]*\n\s*if\(serial!==routeSerial\)return;/);
 assert.match(action,/catch\(e\)\{\s*if\(serial!==routeSerial\)return;/);
 assert.match(action,/finally\{if\(serial===routeSerial\)completeButton\.disabled=!lessonPlayable;?\}/);
});

test('admin cannot edit course inputs during a pending save or accidentally grant twice',()=>{
 const save=section(admin,"$('saveCourseLesson').onclick=async()=>{","$('courseUnit').addEventListener");
 assert.match(save,/courseSaving=true;[\s\S]*?for\(const field of courseEditableFields\)\$\(field\)\.disabled=true;/);
 assert.match(save,/finally\{[\s\S]*?for\(const field of courseEditableFields\)\$\(field\)\.disabled=false;/);
 const issue=section(admin,"$('issue').onclick=()=>run(async()=>{","async function loadMember");
 const grant=section(admin,"$('grant').onclick=()=>run(async()=>{","const menuFeedback");
 for(const block of [issue,grant]){
  assert.match(block,/if\(button\.disabled\)return false;/);
  assert.match(block,/button\.disabled=true;/);
  assert.match(block,/finally\{button\.disabled=false\}/);
 }
 assert.match(admin,/const result=await fn\(\);if\(result!==false\)status\('操作完成'\)/);
});
