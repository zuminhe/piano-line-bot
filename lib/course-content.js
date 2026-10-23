// The official catalog is owned by the instructor; metadata is sourced from v0.3.1.
import {COURSE_CATALOG,catalogLesson,catalogUnit} from './course-catalog.js';
export const COURSE_UNITS=Object.freeze(COURSE_CATALOG.map(({id,name,lessonCount})=>({id,name,lessonCount})));
export const MAX_LESSONS_PER_UNIT=8; // legacy constant retained for compatibility, not shown as slots
const YOUTUBE_ID=/^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID=/^[0-9]{6,12}$/;
const VIMEO_HASH=/^[A-Za-z0-9]{6,64}$/;

export function parseLessonId(id){
  if(typeof id!=='string')return null;
  const m=/^u([1-4])-l(0[1-8])$/.exec(id);
  if(!m)return null;
  const unit=Number(m[1]),number=Number(m[2]);
  if(!catalogLesson(unit,number))return null;
  return {id,unit,number};
}
export function lessonId(unit,number){
  if(!Number.isInteger(unit)||unit<1||unit>4||!Number.isInteger(number)||number<1||!catalogLesson(unit,number))throw Error('Invalid lesson slot');
  return 'u'+unit+'-l'+String(number).padStart(2,'0');
}
export function unitInfo(unit){
  return COURSE_UNITS.find(x=>x.id===Number(unit))||null;
}
export function canViewUnit(access,unit){
  return Number.isInteger(unit) && unit>=1 && unit<=4 && Array.isArray(access?.units) && access.units.includes(unit);
}
export function videoEmbed(raw){
  if(typeof raw!=='string' || !raw.trim())return null;
  if(raw.length>500)return null;
  let u;
  try{u=new URL(raw.trim())}catch{return null}
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname.toLowerCase();
  let id=null,provider=null,hash=null;
  if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtu.be'].includes(host)){
    const path=u.pathname.split('/').filter(Boolean);
    if(host==='youtu.be')id=path.length===1?path[0]:null;
    else if(path[0]==='watch')id=u.searchParams.get('v');
    else if(['embed','shorts','live'].includes(path[0])&&path.length===2)id=path[1];
    if(!YOUTUBE_ID.test(id||''))return null;
    provider='youtube';
    return {provider,embedUrl:'https://www.youtube-nocookie.com/embed/'+id+'?rel=0&playsinline=1'};
  }
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
    const path=u.pathname.split('/').filter(Boolean);
    if(host==='player.vimeo.com'){
      if(path[0]!=='video'||path.length!==2)return null;
      id=path[1];hash=u.searchParams.get('h')||null;
    }else{
      if(path.length!==1&&path.length!==2)return null;
      id=path[0];hash=path[1]||u.searchParams.get('h')||null;
    }
    if(!VIMEO_ID.test(id||'')||(hash&&!VIMEO_HASH.test(hash)))return null;
    provider='vimeo';
    return {provider,embedUrl:'https://player.vimeo.com/video/'+id+(hash?'?h='+hash+'&dnt=1':'?dnt=1')};
  }
  return null;
}
export function safeMaterialUrl(raw){
  if(raw==null || raw==='')return null;
  if(typeof raw!=='string'||raw.length>500)throw Error('講義網址過長或格式不正確');
  let u;try{u=new URL(raw.trim())}catch{throw Error('講義網址格式不正確')}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('講義網址必須使用 HTTPS');
  const host=u.hostname.toLowerCase();
  const allowed = ['drive.google.com','docs.google.com','www.dropbox.com','dropbox.com','notion.so','www.notion.so'].includes(host) || host.endsWith('.notion.site');
  if(!allowed)throw Error('講義請使用 Google Drive、Dropbox 或 Notion 的 HTTPS 分享網址');
  return u.href;
}
export function validateLessonDraft(payload){
  const parsed=parseLessonId(payload?.id);
  if(!parsed)throw Error('課程編號無效');
  const title=String(payload.title||'').trim();
  if(!title||title.length>80||/[\u0000-\u001f]/.test(title))throw Error('課程名稱需為 1～80 字');
  const description=String(payload.description||'').trim();
  if(description.length>800||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description))throw Error('課程說明最多 800 字');
  const videoUrl=String(payload.videoUrl||'').trim();
  const video=videoUrl?videoEmbed(videoUrl):null;
  if(videoUrl&&!video)throw Error('影片網址需為有效 YouTube 或 Vimeo 連結');
  const published=payload.published===true;
  if(published&&!video)throw Error('上架課程前，請先提供有效的影片連結');
  const materialsUrl=safeMaterialUrl(payload.materialsUrl);
  return {
    id:parsed.id,unit:parsed.unit,number:parsed.number,
    title,description,videoUrl,provider:video?.provider||null,
    embedUrl:video?.embedUrl||null,materialsUrl,published
  };
}
