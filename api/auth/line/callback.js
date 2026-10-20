import crypto from 'node:crypto';
import {readOAuth,clearOAuthCookie,createSessionCookie,siteOrigin,setNoStore} from '../../../lib/session.js';
import {exchangeAuthorizationCode,verifyLineIDToken} from '../../../lib/line-login.js';
function matches(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
export default async function handler(req,res) {
  setNoStore(res);
  if(req.method!=='GET')return res.status(405).end();
  res.setHeader('Set-Cookie',clearOAuthCookie());
  const oauth=readOAuth(req);
  if(!oauth || !matches(req.query.state,oauth.state) || typeof req.query.code!=='string'){
    return res.status(400).send('登入已過期或驗證失敗，請重新登入。');
  }
  try{
    const callback=siteOrigin()+'/api/auth/line/callback';
    const idToken=await exchangeAuthorizationCode(req.query.code,callback,oauth.verifier);
    const profile=await verifyLineIDToken(idToken,oauth.nonce);
    res.setHeader('Set-Cookie',[clearOAuthCookie(),createSessionCookie(profile.userId,profile.name)]);
    return res.redirect(303,'/student');
  }catch(e){
    console.error('LINE login callback:',e.message);
    return res.status(401).send('LINE 身分驗證失敗，請返回學生中心重新登入。');
  }
}
