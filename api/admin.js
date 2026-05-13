import { generateCode, saveCode, getAllCodes } from '../lib/codes.js';
import { pushMessage } from '../lib/line.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const PLAN_MAP = {
  'starter':  { name: '入門方案',      richMenuId: process.env.RICH_MENU_STARTER },
  'plan_a':   { name: '帶課陪跑方案A', richMenuId: process.env.RICH_MENU_PLAN_A },
  'plan_b':   { name: '帶課陪跑方案B', richMenuId: process.env.RICH_MENU_PLAN_B },
};

export default async function handler(req, res) {
  // 驗證管理員身份
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // 取得所有驗證碼
    const codes = await getAllCodes();
    return res.status(200).json({ codes });
  }

  if (req.method === 'POST') {
    // 手動建立驗證碼（不需要 Portaly webhook 時用）
    const { plan = 'starter', lineUserId, note } = req.body;
    const planInfo = PLAN_MAP[plan] || PLAN_MAP['starter'];
    const code = generateCode();

    await saveCode({
      code,
      orderId: `MANUAL-${Date.now()}`,
      lineUserId: lineUserId || null,
      plan,
      planName: planInfo.name,
      richMenuId: planInfo.richMenuId,
      note: note || '',
      createdAt: new Date().toISOString(),
      used: false,
    });

    // 如果有 LINE user ID，自動推播
    if (lineUserId) {
      await pushMessage(lineUserId, [
        {
          type: 'text',
          text: `🎹 你的「教會鋼琴手」${planInfo.name}驗證碼：\n\n【 ${code} 】\n\n請在這裡輸入驗證碼開通課程 ✨`,
        }
      ]);
    }

    return res.status(200).json({ success: true, code });
  }

  res.status(405).end();
}
