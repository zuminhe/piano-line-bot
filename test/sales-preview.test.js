import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {COURSE_CATALOG,OFFICIAL_LESSON_COUNT} from '../lib/course-catalog.js';
import {COURSE_UNITS,parseLessonId} from '../lib/course-content.js';
import {readFileSync} from 'node:fs';
test('instructor source of truth lists 23 lessons 6/5/6/6',()=>{
 assert.equal(OFFICIAL_LESSON_COUNT,23);
 assert.deepEqual(COURSE_CATALOG.map(x=>x.lessons.length),[6,5,6,6]);
 assert.deepEqual(COURSE_UNITS.map(x=>x.lessonCount),[6,5,6,6]);
 assert.equal(COURSE_CATALOG[0].lessons[0].title,'彈奏姿勢');
 assert.equal(COURSE_CATALOG[1].lessons[0].title,'延音踏板');
 assert.equal(COURSE_CATALOG[3].lessons[2].title,'和弦配置：音域選擇');
 assert.equal(parseLessonId('u2-l06'),null);
});
test('sales page is strictly preview-only with no accidental checkout',()=>{
 const html=readFileSync(new URL('../sales-preview.html',import.meta.url),'utf8');
 const routes=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).rewrites;
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/尚未開放購買/);
 assert.match(html,/23 堂/);
 assert.match(html,/NT\$3,000/);
 assert.match(html,/價格待定/);
 assert.doesNotMatch(html,/api\/checkout|portaly-webhook|stripe\/checkout/);
 assert.ok(routes.some(x=>x.source==='/sales-preview'&&x.destination==='/sales-preview.html'));
});
test('student, admin and sales page inline JavaScript syntax compiles',()=>{
 for(const file of ['student.html','admin.html','sales-preview.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const scripts=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),m=>m[1].trim()).filter(Boolean);
  assert.ok(scripts.length>0,'no inline script found: '+file);
  for(const script of scripts)assert.doesNotThrow(()=>new Script(script),file);
 }
});
test('student layout has mobile and tablet/desktop breakpoints and progress endpoints',()=>{
 const html=readFileSync(new URL('../student.html',import.meta.url),'utf8');
 assert.match(html,/@media\(min-width:768px\)/);
 assert.match(html,/@media\(max-width:767px\)/);
 assert.match(html,/learning-layout/);
 assert.match(html,/\/api\/student\/progress/);
 const routes=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).rewrites;
 assert.ok(routes.some(x=>x.source==='/api/student/progress'&&x.destination==='/api/course.js?operation=progress'));
});
