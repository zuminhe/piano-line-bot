import {Redis} from '@upstash/redis';
import {readSession,setNoStore} from '../../lib/session.js';
import {memberSummary} from '../../lib/store.js';
import {unitInfo,canViewUnit} from '../../lib/course-content.js';
import {listUnitLessons,studentLessonSummary} from '../../lib/course-store.js';

export async function serveStudentUnit(req,res,options={}){
  setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).end();
  const identity=(options.readIdentity||readSession)(req);
  if(!identity)return res.status(401).json({error:'LOGIN_REQUIRED'});
  const raw=String(req.query?.unit??'');
  if(!/^[1-4]$/.test(raw))return res.status(404).json({error:'UNIT_NOT_FOUND'});
  const unit=Number(raw);
  try{
    const summary=await (options.readMembership||memberSummary)(identity.sub);
    if(!canViewUnit(summary.access,unit))return res.status(403).json({error:'UNIT_NOT_PURCHASED'});
    const db=options.db||Redis.fromEnv();
    const lessons=await listUnitLessons(db,unit);
    return res.json({unit:unitInfo(unit),lessons:lessons.map(studentLessonSummary)});
  }catch(e){
    console.error('Course list unavailable:',e.message);
    return res.status(503).json({error:'COURSE_UNAVAILABLE'});
  }
}
export default function handler(req,res){return serveStudentUnit(req,res)}
