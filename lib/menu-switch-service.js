import crypto from 'node:crypto';
import {menuWritePermission} from './menu-safety.js';
import {inspectPersonalMenuResponse} from './menu-restore-guard.js';
import {buildSingleUserTestMenu} from './rich-menu-test.js';

const MENU = /^richmenu-[0-9a-f]{32}$/i;
const USER = /^U[0-9a-f]{32}$/i;
const asObject = v => typeof v === 'string' ? JSON.parse(v) : v;
const hashed = userId => crypto.createHash('sha256').update(userId).digest('hex');
const backupKey = userId => 'richmenu:original:v1:' + hashed(userId);
const journalKey = userId => 'richmenu:test:journal:v1:' + hashed(userId);
const lockKey = userId => 'richmenu:test:lock:v1:' + hashed(userId);
const releaseScript = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";

// Durable, non-expiring mutex. An unknown external POST result must quarantine
// this user's menu until explicit manual recovery review. Never allow a TTL
// to expire while LINE might still be processing an earlier request.
const QUARANTINE_STATUSES = new Set([
  'intent_persistence_unverified',
  'activation_result_unknown_restore_may_be_needed',
  'restore_result_unknown_manual_check_required'
]);
async function withLock(db,userId,fn) {
  const lock=crypto.randomUUID(),key=lockKey(userId);
  // No EX/TTL: crash or network uncertainty requires human inspection.
  if (await db.set(key,lock,{nx:true}) !== 'OK') {
    return {status:'another_operation_in_progress_or_recovery_required'};
  }
  let result;
  try {
    result=await fn();
  } catch {
    // Unknown state. Keep durable lock and prior snapshot/journal untouched.
    return {status:'unexpected_failure_manual_recovery_required'};
  }
  if (QUARANTINE_STATUSES.has(result?.status)) {
    return result; // Intentionally retain durable lock.
  }
  // Atomic value comparison. Never delete another owner's lock.
  try {
    const released=await db.eval(releaseScript,[key],[lock]);
    if (released!==1) return {status:'lock_release_unverified_manual_review'};
  } catch {
    return {status:'lock_release_unverified_manual_review'};
  }
  return result;
}

function gate(userId,env,mode) {
  if (env[mode] !== 'enabled') return 'operation_disabled';
  const allowed=menuWritePermission(userId,env);
  if (allowed!=='allowed') return allowed;
  if (typeof env.LINE_CHANNEL_ACCESS_TOKEN !== 'string' || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return 'line_token_not_configured';
  }
  if (!MENU.test(env.RICH_MENU_TEST_MENU_ID || '') || !USER.test(userId)) {
    return 'test_menu_not_configured';
  }
  return 'allowed';
}

function validSnapshot(snapshot,userId,testId) {
  return !!snapshot && snapshot.schemaVersion===1 &&
    snapshot.source==='line_per_user_get_200' && snapshot.userId===userId &&
    MENU.test(snapshot.previousPersonalMenuId || '') &&
    snapshot.previousPersonalMenuId!==testId;
}

function validTestMenu(response,liffId) {
  if (response?.status!==200 || !response.body) return false;
  const expected=buildSingleUserTestMenu(liffId), menu=response.body;
  if (menu.name!==expected.name || menu.selected!==false ||
      menu.size?.width!==expected.size.width || menu.size?.height!==expected.size.height ||
      menu.areas?.length!==1 || menu.chatBarText!==expected.chatBarText) return false;
  const a=menu.areas[0],e=expected.areas[0];
  return a.bounds?.x===e.bounds.x && a.bounds?.y===e.bounds.y &&
    a.bounds?.width===e.bounds.width && a.bounds?.height===e.bounds.height &&
    a.action?.type==='uri' && a.action?.uri===e.action.uri &&
    a.action?.label===e.action.label;
}

async function currentMenu(line,userId) {
  const response=await line.getPersonalMenu(userId);
  return inspectPersonalMenuResponse(response?.status,response?.body);
}
function safeLine(line) {
  return !!line && ['getPersonalMenu','getRichMenu','hasRichMenuImage','linkPersonalMenu']
    .every(key=>typeof line[key]==='function');
}

export async function switchToSingleUserTestMenu({userId,env=process.env,db,line}) {
  const allowed=gate(userId,env,'RICH_MENU_SWITCH_TOOLS');
  if (allowed!=='allowed') return {status:allowed};
  if (!safeLine(line) || !db) return {status:'service_not_ready'};
  return withLock(db,userId,async()=>{
    const testId=env.RICH_MENU_TEST_MENU_ID;
    const existing=asObject(await db.get(journalKey(userId)));
    if (existing) return {status:'existing_operation_requires_review'};
    const snapshot=asObject(await db.get(backupKey(userId)));
    if (!validSnapshot(snapshot,userId,testId)) return {status:'missing_verified_original_snapshot'};
    if (!validTestMenu(await line.getRichMenu(testId),env.LINE_LIFF_ID)) {
      return {status:'test_menu_definition_unverified'};
    }
    if (await line.hasRichMenuImage(testId) !== true) {
      return {status:'test_menu_image_unverified'};
    }
    const before=await currentMenu(line,userId);
    if (before.status!=='confirmed_existing' ||
        before.richMenuId!==snapshot.previousPersonalMenuId) {
      return {status:'original_menu_changed_or_unverified'};
    }
    const record={schemaVersion:1,userId,previousPersonalMenuId:snapshot.previousPersonalMenuId,
      testMenuId:testId,phase:'activation_pending',startedAt:new Date().toISOString()};
    // Record intent BEFORE the external side effect. Refuse to overwrite prior attempts.
    if (await db.set(journalKey(userId),JSON.stringify(record),{nx:true})!=='OK') {
      return {status:'existing_operation_requires_review'};
    }
    const check=asObject(await db.get(journalKey(userId)));
    if (check?.testMenuId!==testId || check?.previousPersonalMenuId!==record.previousPersonalMenuId) {
      return {status:'intent_persistence_unverified'};
    }
    let response;
    try {response=await line.linkPersonalMenu(userId,testId);}
    catch {return {status:'activation_result_unknown_restore_may_be_needed'};}
    if (response?.status!==200) return {status:'activation_result_unknown_restore_may_be_needed'};
    const after=await currentMenu(line,userId);
    if (after.status!=='confirmed_existing' || after.richMenuId!==testId) {
      return {status:'activation_result_unknown_restore_may_be_needed'};
    }
    await db.set(journalKey(userId),JSON.stringify({...record,phase:'active'}));
    return {status:'test_menu_active'};
  });
}

export async function restoreSingleUserOriginalMenu({userId,env=process.env,db,line}) {
  const allowed=gate(userId,env,'RICH_MENU_RESTORE_TOOLS');
  if (allowed!=='allowed') return {status:allowed};
  if (!safeLine(line) || !db) return {status:'service_not_ready'};
  return withLock(db,userId,async()=>{
    const journal=asObject(await db.get(journalKey(userId)));
    const snapshot=asObject(await db.get(backupKey(userId)));
    const testId=env.RICH_MENU_TEST_MENU_ID;
    if (!journal || !['activation_pending','active','restoration_pending'].includes(journal.phase) ||
        journal.userId!==userId || journal.testMenuId!==testId ||
        !validSnapshot(snapshot,userId,testId) ||
        journal.previousPersonalMenuId!==snapshot.previousPersonalMenuId) {
      return {status:'restore_refused_missing_or_changed_state'};
    }
    const current=await currentMenu(line,userId);
    if (current.status!=='confirmed_existing' || current.richMenuId!==testId) {
      return {status:'restore_refused_menu_changed_or_unverified'};
    }
    // Persist restore intent; if LINE becomes unavailable, recovery record is retained.
    await db.set(journalKey(userId),JSON.stringify({...journal,phase:'restoration_pending'}));
    let reply;
    try {reply=await line.linkPersonalMenu(userId,snapshot.previousPersonalMenuId);}
    catch {return {status:'restore_result_unknown_manual_check_required'};}
    if (reply?.status!==200) return {status:'restore_result_unknown_manual_check_required'};
    const after=await currentMenu(line,userId);
    if (after.status!=='confirmed_existing' ||
        after.richMenuId!==snapshot.previousPersonalMenuId) {
      return {status:'restore_result_unknown_manual_check_required'};
    }
    // Retain both original snapshot and journal for audit rather than deleting either.
    await db.set(journalKey(userId),JSON.stringify({
      ...journal,phase:'restored',restoredAt:new Date().toISOString()
    }));
    return {status:'original_menu_restored'};
  });
}
