const API = 'https://api.line.me/v2/bot';
async function callLine(method, path, body) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE channel access token is not configured');
  const result = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? {'Content-Type':'application/json'} : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!result.ok) throw new Error('LINE API HTTP ' + result.status + ': ' + (await result.text()).slice(0,200));
  return result;
}
export function replyMessage(replyToken, messages) {
  return callLine('POST', '/message/reply', {replyToken, messages});
}
export function pushMessage(userId, messages) {
  return callLine('POST', '/message/push', {to:userId, messages});
}
export async function syncRichMenu(userId, access) {
  const id = access.coaching ? process.env.RICH_MENU_COACHING
    : access.hasCourse ? process.env.RICH_MENU_MEMBER : process.env.RICH_MENU_GUEST;
  if (id) {
    await callLine('POST', '/user/' + encodeURIComponent(userId) + '/richmenu/' + encodeURIComponent(id));
    return { status: 'linked' };
  }
  if (!access.hasCourse && !access.coaching) {
    await callLine('DELETE', '/user/' + encodeURIComponent(userId) + '/richmenu');
    return { status: 'unlinked' };
  }
  return { status: 'not_configured' };
}
