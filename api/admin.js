import crypto from 'node:crypto';
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
