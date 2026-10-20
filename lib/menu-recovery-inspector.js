import {menuWritePermission} from './menu-safety.js';
import {inspectPersonalMenuResponse} from './menu-restore-guard.js';
import {createHash} from 'node:crypto';

const MENU = /^richmenu-[0-9a-f]{32}$/i;
const keyOf = userId => 'richmenu:test:journal:v1:'+
  createHash('sha256').update(userId).digest('hex');
const backupOf = userId => 'richmenu:original:v1:'+
  createHash('sha256').update(userId).digest('hex');
const parse = v => typeof v==='string'?JSON.parse(v):v;

// Inspection only. This function NEVER tries to change a user's LINE menu.
// Especially if a LINE POST timed out, never repeat POST automatically.
export async function inspectMenuRecovery({userId,env=process.env,db,getPersonalMenu}) {
  if(env.RICH_MENU_RECOVERY_INSPECTION!=='enabled')return {status:'recovery_inspection_disabled'};
  const allowed=menuWritePermission(userId,env);
  if(allowed!=='allowed')return {status:allowed};
  if(typeof getPersonalMenu!=='function')return {status:'reader_unavailable'};
  let journal,snapshot;
  try{
    journal=parse(await db.get(keyOf(userId)));
    snapshot=parse(await db.get(backupOf(userId)));
  }catch{return {status:'recovery_record_unavailable'};}
  if(!journal || !snapshot || journal.userId!==userId || snapshot.userId!==userId ||
    journal.previousPersonalMenuId!==snapshot.previousPersonalMenuId ||
    !MENU.test(journal.testMenuId||'') || !MENU.test(snapshot.previousPersonalMenuId||'') ||
    journal.testMenuId===snapshot.previousPersonalMenuId ||
    journal.testMenuId!==env.RICH_MENU_TEST_MENU_ID) {
    return {status:'recovery_record_unverified'};
  }
  let response;
  try{response=await getPersonalMenu(userId);}
  catch{return {status:'line_status_unknown'};}
  const current=inspectPersonalMenuResponse(response?.status,response?.body);
  if(current.status!=='confirmed_existing')return {status:'line_status_unknown'};
  if(current.richMenuId===snapshot.previousPersonalMenuId) {
    return {status:'original_current_no_write_needed',journalPhase:journal.phase};
  }
  if(current.richMenuId===journal.testMenuId) {
    return {status:'test_menu_current_manual_restore_review',journalPhase:journal.phase};
  }
  return {status:'unexpected_menu_current_do_not_overwrite',journalPhase:journal.phase};
}
