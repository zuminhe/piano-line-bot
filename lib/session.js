import crypto from 'node:crypto';
import { validLineId } from './access.js';

const COOKIE_SESSION='__Host-piano_session';
const COOKIE_OAUTH='__Host-piano_oauth';
export const LOGIN_TTL=10*60;
export const SESSION_TTL=12*60*60;
function secret() {
  const s=process.env.SESSION_SECRET;
  if (!s || s.length<32) throw Error('SESSION_SECRET must have at least 32 characters');
  return s;
}
export function siteOrigin() {
  const raw=process.env.STUDENT_BASE_URL;
  if (!raw) throw Error('STUDENT_BASE_URL missing');
  const u=new URL(raw);
  if (u.protocol!=='https:' || u.username || u.password || u.search || u.hash || u.pathname!=='/') {
    throw Error('STUDENT_BASE_URL must be an HTTPS origin ending in /');
  }
  return u.origin;
}
function b64(input){return Buffer.from(input).toString('base64url')}
export function sign(data, now=Date.now()){
  const raw=b64(JSON.stringify({...data,issuedAt:now}));
  const mac=crypto.createHmac('sha256',secret()).update(raw).digest('base64url');
  return raw+'.'+mac;
}
export function readSigned(token, expectedType, now=Date.now()){
  if(typeof token!=='string' || token.length>3000) return null;
  const parts=token.split('.');
  if(parts.length!==2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const mac=crypto.createHmac('sha256',secret()).update(parts[0]).digest('base64url');
  const a=Buffer.from(mac),b=Buffer.from(parts[1]);
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
  let payload;
  try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}catch{return null}
  if(payload.type!==expectedType || !Number.isFinite(payload.exp) || payload.exp<=now || !Number.isFinite(payload.issuedAt) || payload.issuedAt>now+60000) return null;
  return payload;
}
export function randomToken(size=32){return crypto.randomBytes(size).toString('base64url')}
export function pkceChallenge(verifier){return crypto.createHash('sha256').update(verifier).digest('base64url')}
export function getCookie(req,name){
  const cookies=String(req.headers.cookie||'').split(';');
  for(const cookie of cookies){
    const index=cookie.indexOf('=');
    if(index<0)continue;
    if(cookie.slice(0,index).trim()!==name)continue;
    try{return decodeURIComponent(cookie.slice(index+1).trim())}catch{return null}
  }
  return null;
}
function secureCookie(name,value,age) {
 return name+'='+encodeURIComponent(value)+'; Max-Age='+age+'; Path=/; HttpOnly; Secure; SameSite=Lax';
}
export function createOAuthCookie(state,nonce,verifier){
  return secureCookie(COOKIE_OAUTH,sign({type:'oauth',state,nonce,verifier,exp:Date.now()+LOGIN_TTL*1000}),LOGIN_TTL);
}
export function readOAuth(req){return readSigned(getCookie(req,COOKIE_OAUTH),'oauth')}
export function clearOAuthCookie(){return secureCookie(COOKIE_OAUTH,'',0)}
export function createSessionCookie(userId,displayName=''){
  if(!validLineId(userId))throw Error('Invalid LINE userId');
  return secureCookie(COOKIE_SESSION,sign({type:'session',sub:userId,name:String(displayName).slice(0,80),exp:Date.now()+SESSION_TTL*1000}),SESSION_TTL);
}
export function readSession(req){
  const session=readSigned(getCookie(req,COOKIE_SESSION),'session');
  return session && validLineId(session.sub) ? session : null;
}
export function clearSessionCookie(){return secureCookie(COOKIE_SESSION,'',0)}
export function setNoStore(res){res.setHeader('Cache-Control','no-store')}
