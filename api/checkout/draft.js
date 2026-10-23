import crypto from 'node:crypto';
import {Redis} from '@upstash/redis';
import {readSession,siteOrigin,setNoStore} from '../../lib/session.js';
import {quotePlan} from '../../lib/checkout-pricing.js';

const ORDER_ID=/^ord_[0-9a-f]{32}$/;
const IDEMPOTENCY=/^[A-Za-z0-9_-]{16,64}$/;
const key=id=>'course:order:draft:v1:'+id;
export async function serveCheckoutDraft(req,res,options={}){
 setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
 // Disabled until a provider has been selected and operational flows reviewed.
 if((options.env||process.env).STAGING_ORDER_DRAFTS!=='enabled')return res.status(503).json({error:'ORDER_DRAFTS_DISABLED'});
 if(req.method!=='GET'&&req.method!=='POST')return res.status(405).end();
 const session=(options.readIdentity||readSession)(req);
 if(!session)return res.status(401).json({error:'LOGIN_REQUIRED'});
 if(req.method==='POST'){
  if(req.headers?.origin!==(options.origin||siteOrigin)())return res.status(403).json({error:'INVALID_ORIGIN'});
  if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'JSON_REQUIRED'});
 }
 const db=options.db||Redis.fromEnv();
 try{
  if(req.method==='GET'){
   const id=req.query?.id;
   if(!ORDER_ID.test(id||''))return res.status(404).json({error:'ORDER_NOT_FOUND'});
   const found=await db.get(key(id));
   const entry=typeof found==='string'?JSON.parse(found):found;
   if(!entry||entry.userId!==session.sub)return res.status(404).json({error:'ORDER_NOT_FOUND'});
   return res.json({order:publicOrder(entry)});
  }
  const plan=req.body?.plan;
  const quote=quotePlan(plan);
  if(!quote||quote.amount===null||!Number.isInteger(quote.amount))return res.status(422).json({error:'PRICE_NOT_CONFIGURED'});
  const requestId=req.headers?.['x-order-request-id'];
  if(!IDEMPOTENCY.test(requestId||''))return res.status(400).json({error:'IDEMPOTENCY_KEY_REQUIRED'});
  const idem='course:order:request:v1:'+session.sub+':'+requestId;
  const existing=await db.get(idem);
  if(existing){
   const id=String(existing),found=await db.get(key(id));
   const entry=typeof found==='string'?JSON.parse(found):found;
   if(!entry||entry.userId!==session.sub||entry.plan!==plan)return res.status(409).json({error:'DRAFT_REQUEST_CONFLICT'});
   return res.json({order:publicOrder(entry)});
  }
  const limitKey='course:order:limit:v1:'+session.sub;
  const attempts=await db.incr(limitKey);
  if(attempts===1)await db.expire(limitKey,3600);
  if(attempts>10)return res.status(429).json({error:'TOO_MANY_DRAFTS'});
  const id='ord_'+crypto.randomBytes(16).toString('hex');
  // A draft order has no payment credentials, no provider ref and no entitlements.
  const entry={id,userId:session.sub,plan:quote.plan,label:quote.label,
   amount:quote.amount,currency:'TWD',status:'draft',provider:'unselected',
   createdAt:new Date().toISOString()};
  await db.set(key(id),JSON.stringify(entry),{ex:86400});
  await db.set(idem,id,{ex:3600,nx:true});
  return res.status(201).json({order:publicOrder(entry)});
 }catch(e){
  console.error('Order draft unavailable:',e.message);
  return res.status(503).json({error:'ORDER_DRAFT_UNAVAILABLE'});
 }
}
function publicOrder(entry){
 return {id:entry.id,plan:entry.plan,label:entry.label,amount:entry.amount,
  currency:entry.currency,status:entry.status,createdAt:entry.createdAt,
  paymentEnabled:false};
}
export default function handler(req,res){return serveCheckoutDraft(req,res)}
