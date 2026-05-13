import crypto from 'crypto';
import { validateCode, markCodeUsed, getCodeInfo } from '../lib/codes.js';
import { replyMessage, pushMessage, setRichMenu } from '../lib/line.js';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).end();
if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['x-line-signature'];
  const rawBody = JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const events = req.body.events || [];

  await Promise.all(events.map(async (event) => {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const userId = event.source.userId;
    const text = event.message.text.trim().toUpperCase();
    const replyToken = event.replyToken;

    // 驗證碼格式：大寫字母 + 數字，共 8 碼
    const codePattern = /^[A-Z0-9]{8}$/;

    if (codePattern.test(text)) {
      const result = await validateCode(text, userId);

      if (result.valid && !result.used) {
        // 驗證成功，標記為已使用
        await markCodeUsed(text, userId);

        // 開通圖文選單
        await setRichMenu(userId, result.plan);

        await replyMessage(replyToken, [
          {
            type: 'text',
            text: `✅ 驗證成功！\n\n歡迎加入「教會鋼琴手」${result.planName}！\n\n圖文選單已為你解鎖，點選下方選單即可開始學習 🎹`,
          }
        ]);
      } else if (result.used) {
        await replyMessage(replyToken, [
          {
            type: 'text',
            text: '⚠️ 此驗證碼已被使用過了。\n\n如有疑問請聯繫老師。',
          }
        ]);
      } else {
        await replyMessage(replyToken, [
          {
            type: 'text',
            text: '❌ 驗證碼不正確，請確認後再試一次。\n\n如果持續有問題請聯繫老師。',
          }
        ]);
      }
    } else {
      // 一般訊息，回覆引導
      await replyMessage(replyToken, [
        {
          type: 'text',
          text: '你好！請輸入購課後收到的 8 位驗證碼以開通課程 🎹\n\n範例：ABCD1234',
        }
      ]);
    }
  }));

  res.status(200).end();
}
