import {createHash} from 'node:crypto';
import {menuWritePermission} from './menu-safety.js';
import {inspectPersonalMenuResponse,prepareOriginalMenuSnapshot} from './menu-restore-guard.js';

const keyFor = userId => 'richmenu:original:v1:' + createHash('sha256').update(userId).digest('hex');

// Read-only backup preparation. No LINE write endpoint is used.
// HTTP 404 is ambiguous and never authorizes switching menus.
export async function saveExistingPersonalMenu({userId, env, db, getPersonalMenu}) {
  if (env.RICH_MENU_BACKUP_TOOLS !== 'enabled') return {status:'backup_tools_disabled'};
  const permission = menuWritePermission(userId, env);
  if (permission !== 'allowed') return {status:permission};
  if (typeof getPersonalMenu !== 'function') return {status:'reader_unavailable'};
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return {status:'line_token_not_configured'};
  const key = keyFor(userId);
  if (await db.get(key)) return {status:'already_saved'};
  const response = await getPersonalMenu(userId);
  if (response.reason) return {status:response.reason};
  const inspected = inspectPersonalMenuResponse(response.status,response.body);
  if (inspected.status !== 'confirmed_existing') return {status:inspected.status};
  const prepared = prepareOriginalMenuSnapshot({
    userId,readResult:inspected,createdAt:new Date().toISOString()
  });
  if (prepared.status !== 'prepared') return {status:'refuse_snapshot'};
  const saved = await db.set(key,JSON.stringify(prepared.snapshot),{nx:true});
  if (saved !== 'OK') return {status:'already_saved'};
  // Persisted read-back must match the intended record before declaring success.
  let persisted;
  try {
    persisted = await db.get(key);
    persisted = typeof persisted === 'string' ? JSON.parse(persisted) : persisted;
  } catch {
    return {status:'snapshot_verification_failed'};
  }
  if (persisted?.userId !== userId ||
      persisted?.previousPersonalMenuId !== inspected.richMenuId ||
      persisted?.source !== 'line_per_user_get_200') {
    return {status:'snapshot_verification_failed'};
  }
  return {status:'snapshot_saved'};
}
