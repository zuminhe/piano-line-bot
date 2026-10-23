import {Redis} from '@upstash/redis';
import {readSession,setNoStore} from '../../lib/session.js';
import {memberSummary} from '../../lib/store.js';
import {canViewUnit,parseLessonId,videoEmbed} from '../../lib/course-content.js';
import {loadLesson} from '../../lib/course-store.js';
import {signMuxPlayback} from '../../lib/mux-signed-playback.js';

export async function serveStudentPlayback(req,res,options={}){
 setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const session=(options.readIdentity||readSession)(req);
 if(!session)return res.status(401).json({error:'LOGIN_REQUIRED'});
 const parsed=parseLessonId(req.query?.id);
 if(!parsed)return res.status(404).json({error:'LESSON_NOT_FOUND'});
 try{
  const member=await (options.readMembership||memberSummary)(session.sub);
  if(!canViewUnit(member.access,parsed.unit))return res.status(403).json({error:'UNIT_NOT_PURCHASED'});
  const db=options.db||Redis.fromEnv();
  const lesson=await loadLesson(db,parsed.id);
  const media=lesson.published?videoEmbed(lesson.videoUrl):null;
  if(!media||media.provider!=='mux'||!media.playbackId)return res.status(404).json({error:'MUX_LESSON_NOT_AVAILABLE'});
  let playback;
  try{
   playback=(options.signPlayback||signMuxPlayback)(media.playbackId,options.signOptions||{});
  }catch(e){
   console.error('Mux playback unavailable:',e.message);
   return res.status(503).json({error:'MUX_NOT_CONFIGURED'});
  }
  return res.json(playback);
 }catch(e){
  console.error('Playback access unavailable:',e.message);
  return res.status(503).json({error:'PLAYBACK_UNAVAILABLE'});
 }
}
export default function handler(req,res){return serveStudentPlayback(req,res)}
