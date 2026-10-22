import {Redis} from '@upstash/redis';
import {readSession,setNoStore} from '../../lib/session.js';
import {memberSummary} from '../../lib/store.js';
import {canViewUnit,parseLessonId} from '../../lib/course-content.js';
import {loadLesson,studentLessonDetail} from '../../lib/course-store.js';

export async function serveStudentLesson(req,res,options={}){
  setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).end();
  const identity=(options.readIdentity||readSession)(req);
  if(!identity)return res.status(401).json({error:'LOGIN_REQUIRED'});
  const parsed=parseLessonId(req.query?.id);
  if(!parsed)return res.status(404).json({error:'LESSON_NOT_FOUND'});
  try{
    const member=await (options.readMembership||memberSummary)(identity.sub);
    // This server-side check prevents direct-link bypasses of the unit UI.
    if(!canViewUnit(member.access,parsed.unit))return res.status(403).json({error:'UNIT_NOT_PURCHASED'});
    const db=options.db||Redis.fromEnv();
    const lesson=await loadLesson(db,parsed.id);
    return res.json({lesson:studentLessonDetail(lesson)});
  }catch(e){
    console.error('Course lesson unavailable:',e.message);
    return res.status(503).json({error:'LESSON_UNAVAILABLE'});
  }
}
export default function handler(req,res){return serveStudentLesson(req,res)}
