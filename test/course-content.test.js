import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_UNITS,parseLessonId,lessonId,canViewUnit,videoEmbed,validateLessonDraft,safeMaterialUrl} from '../lib/course-content.js';
import {normalizeStoredLesson,placeholderLesson,studentLessonSummary,studentLessonDetail,listUnitLessons,saveLesson} from '../lib/course-store.js';
import {serveStudentUnit} from '../lib/http/student-unit.js';
import {serveStudentLesson} from '../lib/http/student-lesson.js';
import {readFileSync} from 'node:fs';

const sampleId='u1-l01';
const url='https://youtu.be/AbCdEfG1234';
function dbMock(){
 const m=new Map();
 return {
  m,get:async key=>m.get(key)||null,
  set:async(key,v)=>{m.set(key,v);return 'OK'},
  mget:async(...keys)=>keys.map(k=>m.get(k)||null)
 };
}
function mockRes(){
 return {code:200,headers:{},payload:null,
  setHeader(name,v){this.headers[name]=v;return this},
  status(c){this.code=c;return this},
  json(data){this.payload=data;return this},
  end(){return this}
 };
}
const user={sub:'U'+'a'.repeat(32)};
const allowed={access:{units:[1,2],coaching:false,hasCourse:true}};
const denied={access:{units:[],coaching:false,hasCourse:false}};
function draft(id=sampleId){
 return {id,title:'第一課｜認識鍵盤',description:'從音名開始',videoUrl:url,
  materialsUrl:'https://drive.google.com/file/d/abc/view',published:true};
}
test('course uses official 23-lesson catalog and stable draft IDs',()=>{
 assert.deepEqual(COURSE_UNITS.map(x=>x.name),['基礎樂理','認識和弦','和弦變化','和弦應用']);
 assert.deepEqual(parseLessonId('u4-l06'),{id:'u4-l06',unit:4,number:6});
 assert.equal(parseLessonId('u4-l09'),null);
 assert.equal(parseLessonId('u2-l06'),null);
 assert.equal(parseLessonId('../u1-l01'),null);
 assert.equal(lessonId(1,1),sampleId);
 assert.equal(COURSE_UNITS.reduce((n,u)=>n+u.lessonCount,0),23);
 assert.equal(placeholderLesson('u2-l01').title,'延音踏板');
 assert.equal(placeholderLesson(sampleId).title,'彈奏姿勢');
 assert.equal(placeholderLesson(sampleId).published,false);
 assert.equal(placeholderLesson(sampleId).embedUrl,null);
 assert.equal(canViewUnit({units:[1,2]},1),true);
 assert.equal(canViewUnit({units:[1,2]},3),false);
});
test('allow only validated YouTube and Vimeo HTTPS media URLs',()=>{
 assert.equal(videoEmbed('https://www.youtube.com/watch?v=AbCdEfG1234').embedUrl,'https://www.youtube-nocookie.com/embed/AbCdEfG1234?rel=0&playsinline=1');
 assert.equal(videoEmbed(url).provider,'youtube');
 assert.equal(videoEmbed('https://vimeo.com/123456789/abcdef1234').embedUrl,
  'https://player.vimeo.com/video/123456789?h=abcdef1234&dnt=1');
 for(const bad of ['javascript:alert(1)','http://youtu.be/AbCdEfG1234',
  'https://youtu.be.evil.example/AbCdEfG1234','https://youtu.be/NOTVALID',
  'https://evil.test/video/123456789','https://vimeo.com/123/','https://vimeo.com/123456789/bad-hash',
  'https://user:pass@vimeo.com/123456789']){
  assert.equal(videoEmbed(bad),null,'unexpected allowed: '+bad);
 }
});
test('published video requires valid media and HTTPS whitelisted materials',()=>{
 assert.equal(validateLessonDraft(draft()).published,true);
 assert.throws(()=>validateLessonDraft({...draft(),videoUrl:'',published:true}),/影片/);
 assert.throws(()=>validateLessonDraft({...draft(),videoUrl:'https://evil.test/v/1'}),/影片/);
 assert.throws(()=>validateLessonDraft({...draft(),materialsUrl:'javascript:alert(1)'}),/講義/);
 assert.throws(()=>validateLessonDraft({...draft(),materialsUrl:'https://malware.test/a.pdf'}),/講義/);
 assert.equal(safeMaterialUrl('https://docs.google.com/document/d/1'), 'https://docs.google.com/document/d/1');
});
test('draft lessons never expose player URL to students, published lessons do',()=>{
 const stored=normalizeStoredLesson(sampleId,JSON.stringify({...validateLessonDraft(draft()),updatedAt:'2026-10-22T00:00:00Z'}));
 assert.equal(stored.published,true);
 assert.equal(studentLessonSummary(stored).videoUrl,undefined);
 assert.equal(studentLessonDetail(stored).provider,'youtube');
 const draftOnly={...stored,published:false};
 assert.equal(studentLessonDetail(draftOnly).embedUrl,null);
 assert.equal(studentLessonDetail(draftOnly).materialsUrl,null);
 assert.equal(normalizeStoredLesson(sampleId,JSON.stringify({...stored,id:'u2-l01'})),null);
});
test('admin can save and reread one lesson in storage; other slots remain drafts',async()=>{
 const db=dbMock();
 const saved=await saveLesson(db,draft());
 assert.equal(saved.title,'第一課｜認識鍵盤');
 const lessons=await listUnitLessons(db,1);
 assert.equal(lessons.length,6);
 assert.equal(lessons[0].published,true);
 assert.equal(lessons[1].published,false);
 assert.equal(lessons[1].title,'基礎樂理-五線譜與音名');
 await saveLesson(db,{...draft(),published:false});
 assert.equal((await listUnitLessons(db,1))[0].published,false);
});
test('unit lengths match instructor 6,5,6,6 and previously published test survives catalog upgrade',async()=>{
 const db=dbMock();
 await saveLesson(db,draft());
 const expected=[6,5,6,6];
 for(let unit=1;unit<=4;unit++){
  const items=await listUnitLessons(db,unit);
  assert.equal(items.length,expected[unit-1]);
 }
 const lesson=await listUnitLessons(db,1);
 assert.equal(lesson[0].title,'第一課｜認識鍵盤'); // prior stored metadata preserved
 assert.equal(lesson[0].published,true);
 assert.equal(lesson[0].sourceId,'1-1');
 assert.equal(lesson[5].sourceId,'1-6');
 assert.equal(parseLessonId('u2-l08'),null);
});
test('unauthenticated and unpurchased unit APIs refuse access without reading lesson storage',async()=>{
 let storageReads=0;
 const db={mget:async()=>{storageReads++;throw Error('must not access')},
  get:async()=>{storageReads++;throw Error('must not access')}};
 let res=mockRes();
 await serveStudentUnit({method:'GET',query:{unit:'1'}},res,{
  db,readIdentity:()=>null,readMembership:async()=>{throw Error('must not query')}
 });
 assert.equal(res.code,401);
 res=mockRes();
 await serveStudentUnit({method:'GET',query:{unit:'1'}},res,{
  db,readIdentity:()=>user,readMembership:async()=>denied
 });
 assert.equal(res.code,403);
 res=mockRes();
 await serveStudentLesson({method:'GET',query:{id:sampleId}},res,{
  db,readIdentity:()=>user,readMembership:async()=>denied
 });
 assert.equal(res.code,403);
 assert.equal(storageReads,0);
});
test('paid users can list and open published lessons, locked others cannot',async()=>{
 const db=dbMock();
 await saveLesson(db,draft());
 let res=mockRes();
 await serveStudentUnit({method:'GET',query:{unit:'1'}},res,{
  db,readIdentity:()=>user,readMembership:async()=>allowed
 });
 assert.equal(res.code,200);
 assert.equal(res.payload.lessons[0].title,'第一課｜認識鍵盤');
 assert.equal(res.payload.lessons[0].embedUrl,undefined);
 res=mockRes();
 await serveStudentLesson({method:'GET',query:{id:sampleId}},res,{
  db,readIdentity:()=>user,readMembership:async()=>allowed
 });
 assert.equal(res.code,200);
 assert.match(res.payload.lesson.embedUrl,/youtube-nocookie/);
 res=mockRes();
 await serveStudentLesson({method:'GET',query:{id:'u3-l01'}},res,{
  db,readIdentity:()=>user,readMembership:async()=>allowed
 });
 assert.equal(res.code,403);
 assert.equal(res.headers['Cache-Control'],'no-store');
});
test('lesson IDs cannot be used for directory traversal and invalid methods are rejected',async()=>{
 const db=dbMock();
 let res=mockRes();
 await serveStudentLesson({method:'GET',query:{id:'../admin'}},res,{
  db,readIdentity:()=>user,readMembership:async()=>allowed
 });
 assert.equal(res.code,404);
 res=mockRes();
 await serveStudentUnit({method:'POST',query:{unit:'1'}},res,{
  db,readIdentity:()=>user,readMembership:async()=>allowed
 });
 assert.equal(res.code,405);
});
test('website uses server API for unit and lesson content; admin actions remain admin-authenticated',()=>{
 const html=readFileSync(new URL('../student.html',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
 const routes=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).rewrites;
 assert.match(html,/\/api\/student\/unit\?unit=/);
 assert.match(html,/\/api\/student\/lesson\?id=/);
 assert.match(html,/iframe/);
 assert.match(admin,/payload.action === 'save_course_lesson'/);
 assert.match(admin,/req.query.action === 'course_lesson'/);
 assert.ok(admin.indexOf("if (!authorized(req))") < admin.indexOf("payload.action === 'save_course_lesson'"));
 assert.ok(routes.some(x=>x.source==='/api/student/unit'));
 assert.ok(routes.some(x=>x.source==='/api/student/lesson'));
});
