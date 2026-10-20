import crypto from 'node:crypto';
import {Redis} from '@upstash/redis';
import {prepareUnlinkedTestMenu} from '../lib/detached-richmenu-provision.js';
import {saveExistingPersonalMenu} from '../lib/menu-backup-service.js';
import {getPersonalMenuFromLine} from '../lib/line-menu-read.js';
import {inspectMenuRecovery} from '../lib/menu-recovery-inspector.js';
import {createTestMenuLineAdapter} from '../lib/line-menu-switch-adapter.js';
import { issueCode, addGrant, memberSummary, listMembers, revokeGrant, listVoucherHistory, PLANS } from '../lib/store.js';
import { syncRichMenu } from '../lib/line.js';
function authorized(req) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || expected.length < 24) return false;
  const provided = req.headers.authorization;
  const target = 'Bearer ' + expected;
  const a=Buffer.from(String(provided || '')), b=Buffer.from(target);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
const bad = (res,e) => res.status(400).json({error:e.message});
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!authorized(req)) return res.status(401).json({error:'Unauthorized'});
  try {
    if (req.method === 'GET') {
      if (req.query.action === 'member') return res.json(await memberSummary(String(req.query.userId || '')));
      if (req.query.action === 'members') return res.json({members:await listMembers()});
      if (req.query.action === 'vouchers') return res.json({codes:await listVoucherHistory()});
      return res.json({plans:PLANS, message:'Use action=member, members or vouchers'});
    }
    if (req.method !== 'POST') return res.status(405).end();
    const payload = req.body || {};
    if (payload.action === 'issue_code') {
      const result = await issueCode(payload);
      return res.json(result);
    }
    if (payload.action === 'grant' || payload.action === 'revoke') {
      const userId = payload.userId;
      if (payload.action === 'grant') await addGrant(userId, payload);
      else {
        const ok = await revokeGrant(userId,payload.grantId);
        if (!ok) return res.status(404).json({error:'Grant not found'});
      }
      const member = await memberSummary(userId);
      let menuSync='not_attempted';
      try { menuSync=(await syncRichMenu(userId,member.access)).status; }
      catch(e) { menuSync='error'; console.error('Menu sync failed',e.message); }
      return res.json({member,menuSync});
    }
    if (payload.action === 'backup_personal_menu') {
      // This is a read-only LINE operation followed by a snapshot write to
      // the staging Redis DB. It NEVER creates, links, unlinks or deletes menus.
      if (process.env.RICH_MENU_BACKUP_TOOLS !== 'enabled') {
        return res.json({menuBackup:{status:'backup_tools_disabled'}});
      }
      const db=Redis.fromEnv();
      const menuBackup=await saveExistingPersonalMenu({
        userId:payload.userId,
        env:process.env,db,
        getPersonalMenu:userId=>getPersonalMenuFromLine(userId)
      });
      return res.json({menuBackup});
    }
    if (payload.action === 'provision_test_menu') {
      // Creates and uploads an UNLINKED test menu only. No user/all or user
      // link endpoints. Requires an extra opt-in and an exact approved PNG SHA.
      if (process.env.RICH_MENU_PROVISION_MODE !== 'enabled') {
        return res.json({richMenuProvision:{status:'provision_disabled'}});
      }
      const base64=payload.imageBase64;
      if (typeof base64!=='string' || base64.length>200000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        return res.json({richMenuProvision:{status:'invalid_uploaded_image'}});
      }
      const image=Buffer.from(base64,'base64');
      const db=Redis.fromEnv();
      const richMenuProvision=await prepareUnlinkedTestMenu({
        env:process.env,image,db,allowCreate:true
      });
      return res.json({richMenuProvision});
    }
    if (payload.action === 'inspect_menu_recovery') {
      // Strictly read-only. Inspection never clears locks or changes LINE menus.
      if (process.env.RICH_MENU_RECOVERY_INSPECTION !== 'enabled') {
        return res.json({menuRecovery:{status:'recovery_inspection_disabled'}});
      }
      const db=Redis.fromEnv();
      const adapter=createTestMenuLineAdapter({env:process.env});
      const menuRecovery=await inspectMenuRecovery({
        userId:payload.userId,env:process.env,db,
        getPersonalMenu:userId=>adapter.getPersonalMenu(userId)
      });
      return res.json({menuRecovery});
    }
    if (payload.action === 'sync_menu') {
      const member=await memberSummary(payload.userId);
      return res.json({member,menuSync:await syncRichMenu(payload.userId,member.access)});
    }
    return bad(res,new Error('Unknown action'));
  } catch(e) {
    if (/REDIS|ECONN|FETCH|TOKEN/i.test(e.message || '')) {
      console.error('Admin backend error:',e.message);
      return res.status(503).json({error:'Service unavailable'});
    }
    return bad(res,e);
  }
}
