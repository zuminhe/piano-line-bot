// Single secure entrypoint for the learner's central printable handout library.
// Phase 1 intentionally has no uploaded files or public asset URLs.
// Attach a PRIVATE object store only after the student handouts are finalized.
import {readSession,setNoStore} from '../session.js';
import {memberSummary} from '../store.js';
import {canViewUnit} from '../course-content.js';
import {COURSE_CATALOG} from '../course-catalog.js';

export function studentMaterialCatalog(access){
 return COURSE_CATALOG.map(item=>({
  unit:item.id,
  title:item.name,
  filename:null,
  format:'PDF',
  entitled:canViewUnit(access,item.id),
  published:false,
  status:canViewUnit(access,item.id)?'preparing':'locked'
 }));
}

export async function serveStudentMaterials(req,res,options={}){
 setNoStore(res);
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const identity=(options.readIdentity||readSession)(req);
 if(!identity)return res.status(401).json({error:'LOGIN_REQUIRED'});
 const download=options.download===true;
 const raw=req.query?.unit;
 if(download&&(typeof raw!=='string'||!/^[1-4]$/.test(raw))){
  return res.status(404).json({error:'MATERIAL_NOT_FOUND'});
 }
 try{
  const summary=await (options.readMembership||memberSummary)(identity.sub);
  if(download){
   if(!canViewUnit(summary.access,Number(raw))){
    return res.status(403).json({error:'UNIT_NOT_PURCHASED'});
   }
   // Do not issue a redirect or file URL until private storage and publication
   // are wired in. This route remains server-authorized for the future download.
   return res.status(404).json({error:'MATERIAL_NOT_PUBLISHED'});
  }
  return res.status(200).json({materials:studentMaterialCatalog(summary.access)});
 }catch(e){
  console.error('Handout access unavailable:',e.message);
  return res.status(503).json({error:'MATERIALS_UNAVAILABLE'});
 }
}
