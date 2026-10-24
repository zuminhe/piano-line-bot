// Mocked browser flows. No production LINE identity, Redis, payment or student records.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {chromium} from 'playwright';
import {COURSE_CATALOG} from '../lib/course-catalog.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const records=new Map();
for(const unit of COURSE_CATALOG)for(const lesson of unit.lessons){
 records.set(lesson.id,{...lesson,unit:unit.id,description:'',videoUrl:'',
   published:['u1-l01','u1-l02'].includes(lesson.id),provider:'youtube',
   embedUrl:'https://www.youtube-nocookie.com/embed/AbCdEfG1234',materialsUrl:null});
}
const progress=new Set();
let issued=0,granted=0,saved=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function json(res,status,payload){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(payload));
}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const path=url.pathname,action=url.searchParams.get('action');
 let body={};
 if(req.method==='POST'){
  let input='';for await(const chunk of req)input+=chunk;
  try{body=JSON.parse(input||'{}')}catch{}
 }
 if(path==='/student'||path==='/admin'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(readFileSync(join(root,path==='/student'?'student.html':'admin.html')));
 }
 if(path==='/api/student/me')return json(res,200,{name:'測試學員',access:{units:[1],coaching:false,hasCourse:true}});
 if(path==='/api/student/unit'){
  const unit=COURSE_CATALOG[Number(url.searchParams.get('unit'))-1];
  return json(res,200,{unit,lessons:unit.lessons.map(l=>({id:l.id,number:l.number,title:records.get(l.id).title,
   sourceId:l.sourceId,published:records.get(l.id).published}))});
 }
 if(path==='/api/student/lesson'){
  const record=records.get(url.searchParams.get('id'));
  return json(res,200,{lesson:record});
 }
 if(path==='/api/student/progress'){
  if(req.method==='POST'){
   await sleep(650);
   if(body.completed)progress.add(body.id);else progress.delete(body.id);
   return json(res,200,{id:body.id,completed:body.completed});
  }
  return json(res,200,{unit:1,completed:[...progress]});
 }
 if(path==='/api/student/config')return json(res,200,{liffId:null});
 if(path==='/api/student/materials')return json(res,200,{materials:COURSE_CATALOG.map(u=>({
  unit:u.id,entitled:u.id===1,published:false,status:'preparing'}))});
 if(path==='/api/admin'){
  if(req.method==='GET'){
   if(action==='vouchers')return json(res,200,{codes:[]});
   if(action==='course_lesson')return json(res,200,{lesson:records.get(url.searchParams.get('id'))});
   if(action==='course_unit'){
    const u=COURSE_CATALOG[Number(url.searchParams.get('unit'))-1];
    return json(res,200,{unit:u.id,lessons:u.lessons.map(l=>records.get(l.id))});
   }
   return json(res,200,{plans:{course_full:{label:'完整學習組',entitlements:['unit:1']}}});
  }
  if(body.action==='save_course_lesson'){
   saved++;await sleep(650);
   const item={...records.get(body.lesson.id),...body.lesson,updatedAt:new Date().toISOString()};
   records.set(item.id,item);return json(res,200,{lesson:item});
  }
  if(body.action==='issue_code'){
   issued++;await sleep(650);
   return json(res,200,{code:'TEST1234',expiresAt:'2099-01-01T00:00:00.000Z'});
  }
  if(body.action==='grant'){
   granted++;await sleep(650);
   return json(res,200,{member:{access:{units:[1]},grants:[]},menuSync:'disabled'});
  }
 }
 return json(res,404,{error:'NOT_MOCKED'});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function contextFor(width,height){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 await context.route('https://**/*',route=>route.abort());
 return context;
}
async function wait(page,selector){await page.locator(selector).waitFor({state:'visible',timeout:15000})}
try{
 for(const [device,width,height] of [['phone',375,812],['tablet',820,1180],['desktop',1440,900]]){
  const context=await contextFor(width,height),page=await context.newPage();
  await page.goto(base+'/student');
  await wait(page,'#units .unit');
  assert.equal(await page.locator('#units .unit').count(),4);
  assert.equal(await page.locator('#units .unit').nth(1).isDisabled(),true,'locked unit must stay disabled');
  await page.locator('#units .unit').first().click();
  await wait(page,'#lessonList a.lesson');
  assert.equal(await page.locator('#lessonList a.lesson').count(),6);
  await page.locator('#lessonList a.lesson').first().click();
  await wait(page,'#completeLesson:not([disabled])');
  assert.equal(await page.locator('#completionPanel').isVisible(),true);
  await page.goto(base+'/student#lesson/u1-l03');
  await wait(page,'#lessonHeading');
  await page.waitForFunction(()=>document.querySelector('#lessonHeading').textContent==='基礎樂理-調性與音階');
  assert.equal(await page.locator('#completionPanel').isVisible(),false,'unpublished lesson completion must be hidden');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=2,device+' has horizontal overflow of '+overflow+'px');
  await context.close();
  console.log('PASS student responsive '+device+' '+width+'px, entitled/locked/unpublished flows');
 }
 const context=await contextFor(820,950),page=await context.newPage();
 await page.goto(base+'/student#lesson/u1-l01');
 await wait(page,'#completeLesson:not([disabled])');
 await page.locator('#completeLesson').click();
 await page.waitForFunction(()=>document.querySelector('#completeLesson').textContent.includes('正在儲存'));
 await page.evaluate(()=>{location.hash='lesson/u1-l02'});
 await page.waitForFunction(()=>document.querySelector('#lessonHeading').textContent==='基礎樂理-五線譜與音名');
 await wait(page,'#completeLesson:not([disabled])');
 await sleep(800); // the previous lesson's POST has now resolved
 assert.equal(await page.locator('#completeLesson').textContent(),'已完成這堂課');
 assert.equal(await page.locator('#completeLesson').isDisabled(),false,'stale POST must not disable new lesson action');
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#lessonHeading').textContent==='基礎樂理-五線譜與音名');
 await page.evaluate(()=>{location.hash='unit/1'});
 await page.waitForFunction(()=>document.querySelector('#unitProgress').textContent.includes('已完成 1 / 6'));
 assert.ok(progress.has('u1-l01'),'progress persisted across student reload');
 await context.close();
 console.log('PASS delayed progress POST, lesson navigation, refresh persistence');
 const adminContext=await contextFor(1280,900),admin=await adminContext.newPage();
 admin.on('dialog',dialog=>dialog.accept());
 await admin.goto(base+'/admin');
 await admin.locator('#secret').fill('mock_admin_only');
 await admin.locator('#loginButton').click();
 await wait(admin,'#app');
 await wait(admin,'#courseTitle:not([disabled])');
 await admin.locator('#courseTitle').fill('瀏覽器測試新課名');
 await admin.locator('#saveCourseLesson').click();
 await admin.waitForFunction(()=>document.querySelector('#courseStatus').textContent.includes('正在儲存'));
 assert.equal(await admin.locator('#courseTitle').isDisabled(),true,'editor must freeze during POST');
 await admin.waitForFunction(()=>document.querySelector('#courseStatus').textContent.includes('已儲存'));
 assert.equal(await admin.locator('#courseTitle').isDisabled(),false);
 assert.equal(saved,1);
 await admin.locator('#issue').click();
 await admin.waitForFunction(()=>document.querySelector('#issue').disabled);
 await admin.evaluate(()=>document.querySelector('#issue').click());
 await admin.waitForFunction(()=>document.querySelector('#voucher').textContent.includes('TEST1234'));
 assert.equal(issued,1,'second click during request must not issue another voucher');
 await adminContext.close();
 console.log('PASS admin save lock and duplicate voucher click prevention');
 console.log('Browser QA complete: 3 screen sizes + student async flow + admin flow.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
