import {createHash} from 'node:crypto';
import {buildSingleUserTestMenu} from './rich-menu-test.js';

const MAIN='https://api.line.me/v2/bot';
const DATA='https://api-data.line.me/v2/bot';
const EXPECTED_IMAGE_SHA='5f757ef5c8331e1604933891e9e2f2391a219025e5769c0c37f6018cca2b11fe';
const EXPECTED_LIFF_ID='2009925919-tfNYEEmH';
const TEST_MENU_NAME='Piano-student-staging-one-user-test';
const MENU_ID=/^richmenu-[0-9a-f]{32}$/i;

export function verifyApprovedTestImage(image) {
  if (!Buffer.isBuffer(image) || image.length!==127044 ||
      image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' ||
      image.toString('ascii',12,16)!=='IHDR' ||
      image.readUInt32BE(16)!==2500 || image.readUInt32BE(20)!==1686) {
    return {status:'image_not_approved'};
  }
  if(createHash('sha256').update(image).digest('hex')!==EXPECTED_IMAGE_SHA){
    return {status:'image_not_approved'};
  }
  return {status:'approved'};
}

const fails=reason=>({status:reason});
function exactMenu(menu){
  const expected=buildSingleUserTestMenu(EXPECTED_LIFF_ID);
  return menu?.name===expected.name &&
    menu?.selected===false && menu?.chatBarText===expected.chatBarText &&
    menu?.size?.width===2500 && menu?.size?.height===1686 &&
    Array.isArray(menu?.areas) && menu.areas.length===1 &&
    JSON.stringify(menu.areas[0])===JSON.stringify(expected.areas[0]);
}

async function request(fetchImpl,token,origin,path,{method='GET',body,contentType,parseJson=false}={}) {
  let res;
  try {
    res=await fetchImpl(origin+path,{
      method,redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(7000),
      headers:{Authorization:'Bearer '+token,...(contentType?{'Content-Type':contentType}:{})},
      ...(body!==undefined?{body}:{})
    });
  }catch{return fails('line_network_uncertain');}
  if(res.status!==200)return fails('line_http_unverified');
  if(!parseJson)return {status:'ok'};
  try{return {status:'ok',value:await res.json()};}
  catch{return fails('line_invalid_json');}
}

// A safe, isolated staging-only draft. Never links to any user, never uses
// /user/all, and never deletes an existing menu or sets the default menu.
// An external, durable operator journal is required before enabling live use.
export async function prepareUnlinkedTestMenu({
 env=process.env, image, fetchImpl=fetch, allowCreate=false
}={}) {
  const approved=verifyApprovedTestImage(image);
  if(approved.status!=='approved')return approved;
  const menu=buildSingleUserTestMenu(EXPECTED_LIFF_ID);
  if(!exactMenu(menu))return fails('definition_not_approved');
  if(!allowCreate)return {status:'offline_validation_ok',definition:menu};
  if(env.RICH_MENU_PROVISION_MODE!=='enabled')return fails('provision_disabled');
  if(env.RICH_MENU_TEST_MODE!=='enabled')return fails('test_mode_disabled');
  if(env.LINE_LIFF_ID!==EXPECTED_LIFF_ID)return fails('liff_id_mismatch');
  const token=env.LINE_CHANNEL_ACCESS_TOKEN;
  if(typeof token!=='string' || !token.trim())return fails('line_token_not_configured');

  // First read current list. Never create another identical menu if one already
  // exists; this avoids accidental repeated creation after browser timeouts.
  const existing=await request(fetchImpl,token,MAIN,'/richmenu/list',{parseJson:true});
  if(existing.status!=='ok'||!Array.isArray(existing.value?.richmenus)) {
    return fails('existing_menu_list_unverified');
  }
  if(existing.value.richmenus.some(x=>x?.name===TEST_MENU_NAME)){
    return fails('test_menu_already_exists_review_first');
  }

  const json=JSON.stringify(menu);
  const validated=await request(fetchImpl,token,MAIN,'/richmenu/validate',{
    method:'POST',body:json,contentType:'application/json'
  });
  if(validated.status!=='ok')return fails('definition_line_validation_failed');

  const created=await request(fetchImpl,token,MAIN,'/richmenu',{
    method:'POST',body:json,contentType:'application/json',parseJson:true
  });
  // An ambiguous network result MUST NOT be silently retried.
  if(created.status!=='ok'||!MENU_ID.test(created.value?.richMenuId||'')){
    return fails('creation_result_unknown_do_not_retry');
  }
  const richMenuId=created.value.richMenuId;

  const uploaded=await request(fetchImpl,token,DATA,
    '/richmenu/'+encodeURIComponent(richMenuId)+'/content',{
      method:'POST',body:image,contentType:'image/png'
    });
  if(uploaded.status!=='ok')return {status:'created_but_image_unverified_do_not_retry',richMenuId};

  // Confirm the object is precisely this one, not a different menu.
  const check=await request(fetchImpl,token,MAIN,'/richmenu/'+encodeURIComponent(richMenuId),{parseJson:true});
  if(check.status!=='ok'||!exactMenu(check.value)){
    return {status:'created_but_definition_unverified_do_not_link',richMenuId};
  }
  return {status:'detached_test_menu_created_image_uploaded',richMenuId};
}
