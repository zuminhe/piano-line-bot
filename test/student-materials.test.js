import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// No live Redis requests: production dependencies load with harmless stub settings.
process.env.UPSTASH_REDIS_REST_URL||='https://localhost.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN||='test-placeholder';
const {serveStudentMaterials,studentMaterialCatalog}=await import('../lib/http/student-materials.js');

function response(){
 return {
  statusCode:200,headers:{},body:null,
  setHeader(key,value){this.headers[key]=value;return this},
  status(code){this.statusCode=code;return this},
  json(data){this.body=data;return this},
  end(){return this}
 };
}
const req=(unit,method='GET')=>({method,query:unit?{unit}:{},headers:{}});
const identity=()=>({sub:'Utest-user'});
const member=(units)=>async()=>({access:{units}});

test('catalog lists only entitled status, no document URLs or published files',()=>{
 const items=studentMaterialCatalog({units:[1,2]});
 assert.equal(items.length,4);
 assert.deepEqual(items.map(x=>x.status),['preparing','preparing','locked','locked']);
 assert.deepEqual(items.map(x=>x.published),[false,false,false,false]);
 assert.ok(items.every(x=>x.filename===null && !('url' in x)));
});
test('not logged in: cannot view materials or request a download',async()=>{
 for(const download of [false,true]){
  const res=response();
  await serveStudentMaterials(req('1'),res,{download,readIdentity:()=>null});
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error,'LOGIN_REQUIRED');
 }
});
test('entitled student sees catalog with unit 3/4 locked',async()=>{
 const res=response();
 await serveStudentMaterials(req(),res,{readIdentity:identity,readMembership:member([1,2])});
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.materials.map(x=>x.entitled),[true,true,false,false]);
 assert.equal(res.headers['Cache-Control'],'no-store');
});
test('locked units rejected at the download API, independent of UI',async()=>{
 const res=response();
 await serveStudentMaterials(req('3'),res,{download:true,readIdentity:identity,readMembership:member([1,2])});
 assert.equal(res.statusCode,403);
 assert.equal(res.body.error,'UNIT_NOT_PURCHASED');
});
test('unpublished unit PDFs never return a file or redirect',async()=>{
 const res=response();
 await serveStudentMaterials(req('1'),res,{download:true,readIdentity:identity,readMembership:member([1,2])});
 assert.equal(res.statusCode,404);
 assert.equal(res.body.error,'MATERIAL_NOT_PUBLISHED');
 assert.equal(res.headers.Location,undefined);
});
test('invalid unit and non-GET methods are rejected',async()=>{
 const res=response();
 await serveStudentMaterials(req('0'),res,{download:true,readIdentity:identity});
 assert.equal(res.statusCode,404);
 const post=response();
 await serveStudentMaterials(req(null,'POST'),post,{readIdentity:identity});
 assert.equal(post.statusCode,405);
});

test('learner homepage places handouts after the four-unit course grid',()=>{
 const html=readFileSync(new URL('../student.html',import.meta.url),'utf8');
 const overview=html.indexOf('id="overview"');
 const grid=html.indexOf('id="units"');
 const materials=html.indexOf('href="/student#materials"');
 const nextPanel=html.indexOf('id="materialsPanel"');
 assert.ok(overview>=0 && overview<grid && grid<materials && materials<nextPanel);
 assert.equal((html.match(/href="\/student#materials"/g)||[]).length,1);
 assert.match(html,/id="resourcesHeading">課程講義/);
 assert.doesNotMatch(html,/紙本寄送方案仍在規劃中/);
});
