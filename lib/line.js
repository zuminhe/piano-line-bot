const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = 'https://api.line.me/v2/bot';

async function linePost(path, body) {
  const res = await fetch(`${LINE_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`LINE API error [${path}]:`, err);
  }
  return res;
}

// 回覆訊息（用 replyToken，免費，24 小時內有效）
export async function replyMessage(replyToken, messages) {
  return linePost('/message/reply', { replyToken, messages });
}

// 主動推播（用 userId，需要用戶已加入官方帳號）
export async function pushMessage(userId, messages) {
  return linePost('/message/push', { to: userId, messages });
}

// 設定圖文選單
export async function setRichMenu(userId, plan) {
  const richMenuId = getRichMenuId(plan);
  if (!richMenuId) return;

  const res = await fetch(`${LINE_API}/user/${userId}/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Set rich menu error:', err);
  }
  return res;
}

function getRichMenuId(plan) {
  const map = {
    'starter': process.env.RICH_MENU_STARTER,
    'plan_a':  process.env.RICH_MENU_PLAN_A,
    'plan_b':  process.env.RICH_MENU_PLAN_B,
  };
  return map[plan] || map['starter'];
}
