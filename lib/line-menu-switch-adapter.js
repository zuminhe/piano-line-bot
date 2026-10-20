import {menuWritePermission} from './menu-safety.js';

const API = 'https://api.line.me/v2/bot';
const DATA_API = 'https://api-data.line.me/v2/bot';
const MENU = /^richmenu-[0-9a-f]{32}$/i;
const denied = reason => ({status:0,body:null,reason});

// Isolated adapter: not wired to any webhook or admin route.
// It ONLY targets the allowlisted user's personal rich menu, never /user/all,
// batch endpoints or the existing LINE webhook.
export function createTestMenuLineAdapter({
  env=process.env,fetchImpl=fetch,permittedRestoreMenuId=null
}={}) {
  function commonPermission() {
    const u=env.RICH_MENU_TEST_USER_ID;
    const permission=menuWritePermission(u,env);
    if (permission!=='allowed') return permission;
    if (typeof env.LINE_CHANNEL_ACCESS_TOKEN!=='string' ||
        !env.LINE_CHANNEL_ACCESS_TOKEN.trim()) return 'line_token_not_configured';
    return 'allowed';
  }
  function userPermission(userId) {
    const common=commonPermission();
    return common==='allowed'?menuWritePermission(userId,env):common;
  }
  function testIdPermission(id) {
    const common=commonPermission();
    if(common!=='allowed')return common;
    return MENU.test(id || '') && id===env.RICH_MENU_TEST_MENU_ID
      ? 'allowed':'test_menu_not_configured';
  }
  async function request(method,url,{json=false}={}) {
    let res;
    try {
      res=await fetchImpl(url,{
        method,headers:{Authorization:'Bearer '+env.LINE_CHANNEL_ACCESS_TOKEN},
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(7000)
      });
    }catch{return denied('line_request_unavailable');}
    if(res.status!==200)return {status:res.status,body:null};
    if(!json)return {status:200,body:null};
    try{return {status:200,body:await res.json()};}
    catch{return denied('invalid_line_response');}
  }
  return Object.freeze({
    async getPersonalMenu(userId){
      const check=userPermission(userId);
      if(check!=='allowed')return denied(check);
      return request('GET',API+'/user/'+encodeURIComponent(userId)+'/richmenu',{json:true});
    },
    async getRichMenu(menuId){
      const check=testIdPermission(menuId);
      if(check!=='allowed')return denied(check);
      return request('GET',API+'/richmenu/'+encodeURIComponent(menuId),{json:true});
    },
    async hasRichMenuImage(menuId){
      const check=testIdPermission(menuId);
      if(check!=='allowed')return false;
      // LINE's image-download endpoint uses api-data.line.me (not api.line.me).
      let res;
      try{
        res=await fetchImpl(DATA_API+'/richmenu/'+encodeURIComponent(menuId)+'/content',{
          method:'GET',headers:{Authorization:'Bearer '+env.LINE_CHANNEL_ACCESS_TOKEN},
          redirect:'error',cache:'no-store',signal:AbortSignal.timeout(7000)
        });
        const type=String(res.headers?.get?.('content-type')||'').split(';')[0].trim().toLowerCase();
        return res.status===200 && (type==='image/png' || type==='image/jpeg');
      }catch{return false;}
      finally{
        try {await res?.body?.cancel?.();} catch {/* best-effort cleanup */}
      }
    },
    async linkPersonalMenu(userId,menuId){
      const check=userPermission(userId);
      if(check!=='allowed')return denied(check);
      if(!MENU.test(menuId||''))return denied('invalid_menu_id');
      let optIn;
      if(menuId===env.RICH_MENU_TEST_MENU_ID) {
        optIn=env.RICH_MENU_SWITCH_TOOLS==='enabled';
      } else if(menuId===permittedRestoreMenuId && menuId!==env.RICH_MENU_TEST_MENU_ID) {
        optIn=env.RICH_MENU_RESTORE_TOOLS==='enabled';
      } else {
        return denied('target_menu_not_permitted');
      }
      if(!optIn)return denied('operation_disabled');
      // The only write in this adapter. No unlink/delete/default/bulk API.
      return request('POST',API+'/user/'+encodeURIComponent(userId)+
        '/richmenu/'+encodeURIComponent(menuId));
    }
  });
}
