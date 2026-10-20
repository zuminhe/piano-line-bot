import {menuWritePermission} from './menu-safety.js';

// Read-only LINE Messaging API adapter. Never expose credentials or provider
// error bodies to the browser. This module contains no mutating HTTP methods.
export async function getPersonalMenuFromLine(userId, {env=process.env, fetchImpl=fetch}={}) {
  if (env.RICH_MENU_BACKUP_TOOLS !== 'enabled') {
    return {status:0,body:null,reason:'backup_tools_disabled'};
  }
  if (menuWritePermission(userId,env) !== 'allowed') {
    return {status:0,body:null,reason:'not_allowed'};
  }
  if (typeof env.LINE_CHANNEL_ACCESS_TOKEN !== 'string' ||
      !env.LINE_CHANNEL_ACCESS_TOKEN.trim()) {
    return {status:0,body:null,reason:'line_token_not_configured'};
  }
  let response;
  try {
    response = await fetchImpl(
      'https://api.line.me/v2/bot/user/' + encodeURIComponent(userId) + '/richmenu',
      {
        method:'GET',
        headers:{Authorization:'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN},
        signal:AbortSignal.timeout(8000),
        redirect:'error'
      }
    );
  } catch {
    return {status:0,body:null,reason:'line_read_unavailable'};
  }
  if (response.status !== 200) {
    // 404 must NOT be interpreted as proof that the user has no personal menu.
    return {status:response.status,body:null};
  }
  try {
    const data=await response.json();
    return {status:200,body:{richMenuId:data?.richMenuId}};
  } catch {
    return {status:0,body:null,reason:'line_invalid_response'};
  }
}
