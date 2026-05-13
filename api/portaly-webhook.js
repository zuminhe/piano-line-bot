import { generateCode, saveCode } from '../lib/codes.js';
import { pushMessage } from '../lib/line.js';

const PORTALY_SECRET = process.env.PORTALY_WEBHOOK_SECRET;

// 方案對應表
const PLAN_MAP = {
  'starter':  { name: '入門方案',      richMenuId: process.env.RICH_MENU_STARTER },
  'plan_a':   { name: '帶課陪跑方案A', richMenuId: process.env.RICH_MENU_PLAN_A },
  'plan_b':   { name: '帶課陪跑方案B', richMenuId: process.env.RICH_MENU_PLAN_B },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // 簡單驗證 Portaly 來源（在 Portaly webhook 設定裡加一個 secret query param）
  const secret = req.query.secret;
  if (PORTALY_SECRET && secret !== PORTALY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { order_id, product_id, customer } = req.body;

  // customer 裡的 LINE user ID（要在 Portaly 購買表單加一個欄位讓學員填）
  const lineUserId = customer?.custom_fields?.line_user_id;
  const email = customer?.email;
  const productKey = customer?.custom_fields?.plan || 'starter';

  if (!lineUserId) {
    // 沒有 LINE ID 就跳過，等學員自己找老師
    console.log('No LINE user ID for order:', order_id);
    return res.status(200).json({ message: 'No LINE user ID, skipped' });
  }

  // 產生驗證碼
  const code = generateCode();
  const plan = PLAN_MAP[productKey] || PLAN_MAP['starter'];

  // 儲存驗證碼
  await saveCode({
    code,
    orderId: order_id,
    lineUserId,
    email,
    plan: productKey,
    planName: plan.name,
    richMenuId: plan.richMenuId,
    createdAt: new Date().toISOString(),
    used: false,
  });

  // 推播驗證碼給學員
  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: `🎹 感謝你購買「教會鋼琴手」${plan.name}！\n\n你的專屬驗證碼：\n\n【 ${code} 】\n\n請直接在這裡輸入驗證碼，即可解鎖你的課程圖文選單 ✨`,
    }
  ]);

  res.status(200).json({ success: true, code });
}
