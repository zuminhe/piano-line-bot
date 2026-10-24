import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import routeHandler from '../api/course.js';
const json=()=>JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
function response(){
 return {statusCode:200,payload:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.statusCode=n;return this},
  json(x){this.payload=x;return this},
  end(){return this}
 };
}
test('Vercel Hobby function count remains below 12',()=>{
 const root=new URL('../api/',import.meta.url).pathname;
 const all=[];
 function collect(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,e.name);
  if(e.isDirectory())collect(path);
  else if(e.isFile()&&e.name.endsWith('.js'))all.push(path);
 }}
 collect(root);
 assert.ok(all.length<=12,'Too many Vercel Functions: '+all.join(', '));
 assert.equal(all.length,10);
});
test('all six course/checkout URLs route to one Vercel Function',()=>{
 const destinations={
 '/api/student/unit':'unit',
 '/api/student/lesson':'lesson',
 '/api/student/progress':'progress',
 '/api/student/playback':'playback',
 '/api/checkout/quote':'quote',
 '/api/checkout/draft':'draft'
 };
 for(const [source,op] of Object.entries(destinations)){
  const row=json().rewrites.find(x=>x.source===source);
  assert.deepEqual(row,{source,destination:'/api/course.js?operation='+op});
 }
});
test('unknown operation fails closed; public quotes work; protected operations remain protected',async()=>{
 let result=response();
 await routeHandler({method:'GET',query:{operation:'superadmin'}},result);
 assert.equal(result.statusCode,404);
 result=response();
 await routeHandler({method:'GET',query:{operation:'quote',plan:'course_full'}},result);
 assert.equal(result.statusCode,200);
 assert.equal(result.payload.quote.checkoutEnabled,false);
 result=response();
 await routeHandler({method:'GET',query:{operation:'playback',id:'u1-l02'},headers:{}},result);
 assert.equal(result.statusCode,401);
 result=response();
 await routeHandler({method:'GET',query:{operation:'lesson',id:'u1-l02'},headers:{}},result);
 assert.equal(result.statusCode,401);
 result=response();
 await routeHandler({method:'POST',query:{operation:'draft'},headers:{},body:{plan:'course_full'}},result);
 assert.equal(result.statusCode,503);
});
