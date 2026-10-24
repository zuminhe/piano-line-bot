import {Redis} from '@upstash/redis';
import {readSession,setNoStore,siteOrigin} from '../session.js';
import {memberSummary} from '../store.js';
import {canViewUnit,parseLessonId} from '../course-content.js';
import {loadLesson} from '../course-store.js';
import {catalogUnit} from '../course-catalog.js';

export const progressKey=(userId,unit)=>'course:progress:v1:'+userId+':unit:'+unit;
export async function serveStudentProgress(req,res,options={}){
 setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='POST')return res.status(405).end();
 const identity=(options.readIdentity||readSession)(req);
 if(!identity)return res.status(401).json({error:'LOGIN_REQUIRED'});
 if(req.method==='POST'){
  const origin=req.headers?.origin||'';
  const expected=(options.origin||siteOrigin)();
  if(origin!==expected)return res.status(403).json({error:'ORIGIN_REQUIRED'});
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'JSON_REQUIRED'});
 }
 const parsed=req.method==='POST'?parseLessonId(req.body?.id):null;
 const unit=req.method==='GET'?Number(req.query?.unit):parsed?.unit;
 if(!catalogUnit(unit)||req.method==='POST'&&(!parsed||typeof req.body?.completed!=='boolean'))return res.status(400).json({error:'INVALID_COURSE_PROGRESS'});
 try{
  const member=await (options.readMembership||memberSummary)(identity.sub);
  if(!canViewUnit(member.access,unit))return res.status(403).json({error:'UNIT_NOT_PURCHASED'});
  const db=options.db||Redis.fromEnv();
  const key=progressKey(identity.sub,unit);
  if(req.method==='GET'){
   const saved=await db.smembers(key)||[];
   const completed=saved.filter(id=>{const item=parseLessonId(id);return item&&item.unit===unit});
   return res.json({unit,completed});
  }
  if(req.body.completed){
   // A student cannot claim a placeholder lesson as completed.
   const lesson=await loadLesson(db,parsed.id);
   if(!lesson.published)return res.status(409).json({error:'LESSON_NOT_PUBLISHED'});
   await db.sadd(key,parsed.id);
  }else{
   await db.srem(key,parsed.id);
  }
  return res.json({id:parsed.id,completed:req.body.completed});
 }catch(e){
  console.error('Progress unavailable:',e.message);
  return res.status(503).json({error:'PROGRESS_UNAVAILABLE'});
 }
}
export default function handler(req,res){return serveStudentProgress(req,res)}
