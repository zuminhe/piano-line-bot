import {lessonId,parseLessonId,validateLessonDraft,videoEmbed} from './course-content.js';
import {catalogLesson,catalogUnit} from './course-catalog.js';

export const lessonDbKey=id=>'course:lesson:v1:'+id;
const parseRaw=raw=>{
  if(raw==null)return null;
  try{return typeof raw==='string'?JSON.parse(raw):raw}catch{return null}
};
export function normalizeStoredLesson(id,raw){
  const parsed=parseLessonId(id);
  if(!parsed)return null;
  const entry=parseRaw(raw);
  if(!entry||entry.id!==id)return null;
  try{
    const safe=validateLessonDraft(entry);
    const official=catalogLesson(parsed.unit,parsed.number);
    return {...safe,sourceId:official.sourceId,updatedAt:typeof entry.updatedAt==='string'?entry.updatedAt:null};
  }catch{return null}
}
export function placeholderLesson(id){
  const parsed=parseLessonId(id);
  if(!parsed)throw Error('Invalid lesson');
  const official=catalogLesson(parsed.unit,parsed.number);
  return {id,unit:parsed.unit,number:parsed.number,sourceId:official.sourceId,title:official.title,
    description:official.videoPending?'這堂課的影片尚待錄製。':'正式影片尚未上架。',videoUrl:'',provider:null,embedUrl:null,
    materialsUrl:null,published:false,updatedAt:null};
}
export async function loadLesson(db,id){
  if(!parseLessonId(id))throw Error('Invalid lesson ID');
  const record=await db.get(lessonDbKey(id));
  return normalizeStoredLesson(id,record)||placeholderLesson(id);
}
export async function listUnitLessons(db,unit){
  const n=Number(unit);
  if(!Number.isInteger(n)||n<1||n>4)throw Error('Invalid unit');
  const ids=catalogUnit(n).lessons.map(({id})=>id);
  const records=await db.mget(...ids.map(lessonDbKey));
  if(!Array.isArray(records)||records.length!==ids.length)throw Error('Course catalog temporarily unavailable');
  return ids.map((id,i)=>normalizeStoredLesson(id,records[i])||placeholderLesson(id));
}
export function studentLessonSummary(item){
  // Do not include actual video URL, embed URL or material URL in the unit listing.
  return {id:item.id,sourceId:item.sourceId||catalogLesson(item.unit,item.number).sourceId,number:item.number,title:item.title,published:item.published};
}
export function studentLessonDetail(item){
  const player=item.published&&item.videoUrl?videoEmbed(item.videoUrl):null;
  // Defense in depth: refuse embeds that no longer pass the video allowlist.
  return {id:item.id,sourceId:item.sourceId||catalogLesson(item.unit,item.number).sourceId,unit:item.unit,number:item.number,title:item.title,
    description:item.description,published:Boolean(item.published&&player),
    embedUrl:item.published&&player?player.embedUrl:null,provider:player?.provider||null};
  // Per-lesson external handout links are intentionally not returned to students.
  // The central, access-controlled handout library replaces that legacy UI.
}
export async function saveLesson(db,input){
  const lesson=validateLessonDraft(input);
  const item={...lesson,updatedAt:new Date().toISOString()};
  await db.set(lessonDbKey(lesson.id),JSON.stringify(item));
  const persisted=normalizeStoredLesson(lesson.id,await db.get(lessonDbKey(lesson.id)));
  if(!persisted||persisted.title!==item.title||persisted.published!==item.published||
     persisted.videoUrl!==item.videoUrl)throw Error('課程內容寫入後驗證失敗');
  return persisted;
}
