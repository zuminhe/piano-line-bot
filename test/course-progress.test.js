import test from 'node:test';
import assert from 'node:assert/strict';
import {serveStudentProgress} from '../lib/http/student-progress.js';
import {saveLesson} from '../lib/course-store.js';
import {progressKey} from '../lib/http/student-progress.js';

const u={sub:'U'+'c'.repeat(32)};
const membership={access:{units:[1,2],coaching:false,hasCourse:true}};
const db=()=>{
 const vals=new Map(),sets=new Map();
 return {vals,sets,
  get:async k=>vals.get(k)||null,
  set:async(k,v)=>{vals.set(k,v);return 'OK'},
  sadd:async(k,v)=>{if(!sets.has(k))sets.set(k,new Set());sets.get(k).add(v)},
  srem:async(k,v)=>{sets.get(k)?.delete(v)},
  smembers:async k=>Array.from(sets.get(k)||[])
 };
};
const res=()=>({statusCode:200,headers:{},payload:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(x){this.payload=x;return this},
 end(){return this}
});
const common={origin:()=> 'https://piano-line-bot-staging.vercel.app',readIdentity:()=>u,readMembership:async()=>membership};
const post=(id,completed,origin='https://piano-line-bot-staging.vercel.app')=>({method:'POST',headers:{origin,'content-type':'application/json'},body:{id,completed}});
const get=unit=>({method:'GET',query:{unit:String(unit)},headers:{}});
test('progress is tied to the LINE user and lesson source ID',()=>{
 assert.equal(progressKey(u.sub,1),'course:progress:v1:'+u.sub+':unit:1');
});
test('cannot mark an unlisted lesson completed',async()=>{
 const m=db(),r=res();
 await serveStudentProgress(post('u1-l02',true),r,{...common,db:m});
 assert.equal(r.statusCode,409);
 assert.equal(m.sets.size,0);
});
test('owner may complete / undo an already-published lesson',async()=>{
 const m=db();
 await saveLesson(m,{id:'u1-l01',title:'測試',videoUrl:'https://youtu.be/AbCdEfG1234',published:true});
 let r=res();
 await serveStudentProgress(post('u1-l01',true),r,{...common,db:m});
 assert.equal(r.statusCode,200);
 r=res();
 await serveStudentProgress(get(1),r,{...common,db:m});
 assert.deepEqual(r.payload.completed,['u1-l01']);
 r=res();
 await serveStudentProgress(post('u1-l01',false),r,{...common,db:m});
 assert.equal(r.statusCode,200);
 r=res();await serveStudentProgress(get(1),r,{...common,db:m});
 assert.deepEqual(r.payload.completed,[]);
});
test('progress requests fail if origin is wrong, no membership, or invalid lesson id',async()=>{
 const m=db();
 let r=res();
 await serveStudentProgress(post('u1-l01',true,'https://attacker.example'),r,{...common,db:m});
 assert.equal(r.statusCode,403);
 r=res();
 await serveStudentProgress(post('u3-l01',true),r,{...common,db:m});
 assert.equal(r.statusCode,403);
 r=res();
 await serveStudentProgress(post('u2-l08',true),r,{...common,db:m});
 assert.equal(r.statusCode,400);
 r=res();
 await serveStudentProgress(get(3),r,{...common,db:m});
 assert.equal(r.statusCode,403);
});
test('unauthenticated users cannot read progress',async()=>{
 const r=res();
 await serveStudentProgress(get(1),r,{...common,readIdentity:()=>null,db:db()});
 assert.equal(r.statusCode,401);
});
