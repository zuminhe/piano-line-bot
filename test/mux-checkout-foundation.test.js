import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {videoEmbed,validateLessonDraft} from '../lib/course-content.js';
import {studentLessonDetail,saveLesson} from '../lib/course-store.js';
import {serveStudentPlayback} from '../lib/http/student-playback.js';
import {muxSigningConfigured,signMuxPlayback,MUX_TOKEN_TTL_SECONDS} from '../lib/mux-signed-playback.js';
import {quotePlan,verifiedPaymentMatches} from '../lib/checkout-pricing.js';
import {serveCheckoutDraft} from '../lib/http/checkout-draft.js';
import quoteHandler from '../lib/http/checkout-quote.js';

const user={sub:'U'+'e'.repeat(32)};
const another={sub:'U'+'f'.repeat(32)};
const allowed={access:{units:[1,2],coaching:false,hasCourse:true}};
const denied={access:{units:[],coaching:false,hasCourse:false}};
const id='u1-l02';
const muxId='AbCdEf0123456789MuxTest1234';
const muxUrl='mux:signed:'+muxId;
const origin='https://piano-line-bot-staging.vercel.app';
const validLesson={id,title:'簽署影片測試',description:'',videoUrl:muxUrl,materialsUrl:'',published:true};
const db=()=>{const map=new Map();return {
 map,
 get:async key=>map.get(key)||null,
 set:async(key,value,opts={})=>{if(opts.nx&&map.has(key))return null;map.set(key,value);return 'OK'},
 mget:async(...keys)=>keys.map(k=>map.get(k)||null),
 incr:async key=>{const n=Number(map.get(key)||0)+1;map.set(key,n);return n},
 expire:async()=>true
}};
function res(){
 return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.statusCode=n;return this},
  json(obj){this.body=obj;return this},
  end(){return this}
 };
}
const getReq=(id)=>({method:'GET',query:{id}});
const muxOptions=(store)=>({db:store,readIdentity:()=>user,readMembership:async()=>allowed,
 signPlayback:pid=>({provider:'mux',playbackId:pid,tokens:{playback:'test-only',thumbnail:'t',storyboard:'s'},expiresAt:'test'})});
test('Mux URLs are explicit signed IDs rather than unprotected external embeds',()=>{
 assert.deepEqual(videoEmbed(muxUrl),{provider:'mux',playbackId:muxId,embedUrl:null});
 assert.equal(videoEmbed('mux:public:'+muxId),null);
 assert.equal(videoEmbed('mux:signed:../secret'),null);
 assert.equal(videoEmbed('https://player.mux.com/'+muxId),null);
 assert.equal(videoEmbed('http://youtu.be/AbCdEfG1234'),null);
 assert.equal(validateLessonDraft(validLesson).provider,'mux');
 const details=studentLessonDetail({...validateLessonDraft(validLesson),published:true});
 assert.equal(details.published,true);
 assert.equal(details.provider,'mux');
 assert.equal(details.embedUrl,null);
 assert.equal(details.videoUrl,undefined);
});
test('only paid signed-in users receive Mux credential-bearing response',async()=>{
 let dbReads=0;
 const protectedDb={get:async()=>{dbReads++;throw Error('disallowed')},mget:async()=>[]};
 let result=res();
 await serveStudentPlayback(getReq(id),result,{db:protectedDb,readIdentity:()=>null,readMembership:async()=>{throw Error('identity missing')}});
 assert.equal(result.statusCode,401);
 result=res();
 await serveStudentPlayback(getReq(id),result,{db:protectedDb,readIdentity:()=>user,readMembership:async()=>denied,
  signPlayback:()=>{throw Error('should not sign')}});
 assert.equal(result.statusCode,403);
 assert.equal(dbReads,0);
});
test('signed token API is unavailable for unpublished / YouTube lessons',async()=>{
 const store=db();
 let result=res();
 await serveStudentPlayback(getReq(id),result,muxOptions(store));
 assert.equal(result.statusCode,404);
 await saveLesson(store,{...validLesson,videoUrl:'https://youtu.be/AbCdEfG1234'});
 result=res();
 await serveStudentPlayback(getReq(id),result,muxOptions(store));
 assert.equal(result.statusCode,404);
});
test('signed token API returns provider-scoped playback without user secrets',async()=>{
 const store=db();await saveLesson(store,validLesson);
 let result=res();
 await serveStudentPlayback(getReq(id),result,muxOptions(store));
 assert.equal(result.statusCode,200);
 assert.equal(result.body.provider,'mux');
 assert.equal(result.body.playbackId,muxId);
 assert.equal(result.body.tokens.playback,'test-only');
 assert.equal(result.body.videoUrl,undefined);
 assert.equal(result.body.userId,undefined);
 assert.equal(result.headers['Cache-Control'],'no-store');
 result=res();
 await serveStudentPlayback(getReq('u3-l01'),result,muxOptions(store));
 assert.equal(result.statusCode,403);
});
test('Mux signer issues valid RS256 JWTs with video, thumbnail, storyboard audiences and 2h expiry',()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const env={
 MUX_SIGNED_PLAYBACK_ENABLED:'enabled',
 MUX_SIGNING_KEY_ID:'testKey_123456',
 MUX_SIGNING_PRIVATE_KEY_BASE64:Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')
 };
 assert.equal(muxSigningConfigured(env),true);
 const at=Date.parse('2026-10-23T14:00:00.000Z');
 const signed=signMuxPlayback(muxId,{env,now:at});
 for(const [type,aud] of [['playback','v'],['thumbnail','t'],['storyboard','s']]){
  const parts=signed.tokens[type].split('.');
  assert.equal(parts.length,3);
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,Buffer.from(parts[2],'base64url')),true);
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  assert.equal(header.alg,'RS256');assert.equal(header.kid,env.MUX_SIGNING_KEY_ID);
  assert.equal(payload.sub,muxId);
  assert.equal(payload.aud,aud);
  assert.equal(payload.exp-payload.iat,MUX_TOKEN_TTL_SECONDS);
  assert.equal(payload.userId,undefined);
 }
 assert.throws(()=>signMuxPlayback(muxId,{env:{}}),/MUX_NOT_CONFIGURED/);
 assert.throws(()=>signMuxPlayback('x',{env}),/INVALID_MUX_PLAYBACK_ID/);
});
test('a bad signer configuration fails closed without returning any playable token',async()=>{
 const store=db();await saveLesson(store,validLesson);
 const result=res();
 await serveStudentPlayback(getReq(id),result,{db:store,readIdentity:()=>user,readMembership:async()=>allowed,signOptions:{env:{}}});
 assert.equal(result.statusCode,503);
 assert.equal(result.body.error,'MUX_NOT_CONFIGURED');
 assert.equal(result.body.tokens,undefined);
});
test('quoted package amounts are server controlled, incomplete prices never become payable',()=>{
 assert.deepEqual(quotePlan('course_full'),{plan:'course_full',label:'完整學習組',units:[1,2,3,4],currency:'TWD',amount:3000,priceConfirmed:false,checkoutEnabled:false});
 assert.equal(quotePlan('course_basic').amount,null);
 assert.equal(quotePlan('course_advanced').amount,null);
 assert.equal(quotePlan('course_premium'),null);
 let result=res();
 quoteHandler({method:'GET',query:{plan:'course_full'}},result);
 assert.equal(result.statusCode,200);assert.equal(result.body.quote.checkoutEnabled,false);
 result=res();
 quoteHandler({method:'GET',query:{plan:'course_basic'}},result);
 assert.equal(result.body.quote.amount,null);
});
test('client-side paid flag or forged provider data cannot pass payment proof contract',()=>{
 const order={id:'ord_123',status:'awaiting_verified_payment',plan:'course_full',amount:3000,currency:'TWD',provider:'ecpay'};
 const event={verifiedByProvider:true,orderId:'ord_123',amount:3000,currency:'TWD',provider:'ecpay',transactionId:'TX123456'};
 assert.equal(verifiedPaymentMatches(order,{...event,verifiedByProvider:false}),false);
 assert.equal(verifiedPaymentMatches(order,{...event,amount:1}),false);
 assert.equal(verifiedPaymentMatches(order,{...event,orderId:'other'}),false);
 assert.equal(verifiedPaymentMatches({...order,status:'draft'},event),false);
 assert.equal(verifiedPaymentMatches(order,{...event,provider:'newebpay'}),false);
 assert.equal(verifiedPaymentMatches(order,event),true); // domain matching only; does NOT verify signature
});
test('draft order creation is disabled by default and never creates grants',async()=>{
 const store=db(),request={method:'POST',headers:{origin,'content-type':'application/json','x-order-request-id':'requestId0000000001'},body:{plan:'course_full',amount:1,paid:true}};
 let result=res();
 await serveCheckoutDraft(request,result,{db:store,env:{},readIdentity:()=>user,origin:()=>origin});
 assert.equal(result.statusCode,503);assert.equal(result.body.error,'ORDER_DRAFTS_DISABLED');
 assert.equal(store.map.size,0);
});
test('when explicitly enabled, drafts are priced server side and remain unpaid',async()=>{
 const store=db(),config={db:store,env:{STAGING_ORDER_DRAFTS:'enabled'},readIdentity:()=>user,origin:()=>origin};
 const req={method:'POST',headers:{origin,'content-type':'application/json','x-order-request-id':'requestId0000000001'},body:{plan:'course_full',amount:1,paid:true,status:'paid'}};
 let result=res();await serveCheckoutDraft(req,result,config);
 assert.equal(result.statusCode,201);
 assert.equal(result.body.order.amount,3000);
 assert.equal(result.body.order.status,'draft');
 assert.equal(result.body.order.paymentEnabled,false);
 assert.equal(result.body.order.grant,undefined);
 const id=result.body.order.id;
 result=res();await serveCheckoutDraft(req,result,config);
 assert.equal(result.statusCode,200);assert.equal(result.body.order.id,id);
 result=res();await serveCheckoutDraft({method:'GET',query:{id},headers:{}},result,config);
 assert.equal(result.statusCode,200);
 result=res();await serveCheckoutDraft({method:'GET',query:{id},headers:{}},result,{...config,readIdentity:()=>another});
 assert.equal(result.statusCode,404);
 result=res();await serveCheckoutDraft({...req,headers:{...req.headers,origin:'https://evil.example'}},result,config);
 assert.equal(result.statusCode,403);
 result=res();await serveCheckoutDraft({...req,headers:{...req.headers,'x-order-request-id':'requestId0000000002'},body:{plan:'course_basic'}},result,config);
 assert.equal(result.statusCode,422);
});
