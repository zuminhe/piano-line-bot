import crypto from 'node:crypto';
import { redeemCode, isCode, memberSummary } from '../lib/store.js';
import { replyMessage, syncRichMenu } from '../lib/line.js';
export const config = { api: { bodyParser: false } };
async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function verify(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || typeof signature !== 'string') return false;
  const digest = crypto.createHmac('sha256',secret).update(body).digest();
  const supplied = Buffer.from(signature, 'base64');
  return supplied.length === digest.length && crypto.timingSafeEqual(supplied,digest);
}
export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).end();
  let body;
  try { body = await readBody(req); } catch { return res.status(413).end(); }
  if (!verify(body, req.headers['x-line-signature'])) return res.status(401).end();
  let payload;
  try { payload=JSON.parse(body.toString('utf8')); } catch { return res.status(400).end(); }
  try {
    for (const event of payload.events || []) {
      if (event.type !== 'message' || event.message?.type !== 'text' || !event.source?.userId) continue;
      const text = event.message.text.trim().toUpperCase();
      if (!isCode(text)) {
        await replyMessage(event.replyToken,[{type:'text',text:'歡迎來到終極和弦伴奏公式 🎹\n如果已購買課程，請輸入購課後取得的 8 位驗證碼。其他問題可聯絡老師。'}]);
        continue;
      }
      const result = await redeemCode(text,event.source.userId);
      if (result.status === 'ok') {
        const member = await memberSummary(event.source.userId);
        let menuNote = '';
        try {
          const sync = await syncRichMenu(event.source.userId,member.access);
          if (sync.status === 'not_configured') menuNote = '\n學員選單尚在設定，請聯絡老師取得課程入口。';
        } catch {
          menuNote = '\n學員權益已開通，但選單尚未更新。請稍後聯絡老師處理。';
        }
        await replyMessage(event.replyToken,[{type:'text',text:'✅ 課程權益已綁定你的 LINE 帳號。'+menuNote}]);
      } else {
        const messages={invalid:'驗證碼無效、已使用或已過期，請確認後再試。',bound:'此驗證碼不是為這個 LINE 帳號核發，請聯絡老師。',rate_limited:'輸入次數過多，請一小時後再試或聯絡老師。'};
        await replyMessage(event.replyToken,[{type:'text',text:messages[result.status] || messages.invalid}]);
      }
    }
    return res.status(200).end();
  } catch (e) {
    console.error('LINE webhook processing failed:',e?.message);
    return res.status(500).end();
  }
}
