import {randomToken,pkceChallenge,createOAuthCookie,siteOrigin,setNoStore} from '../../../lib/session.js';
import {lineAuthorizationURL} from '../../../lib/line-login.js';
export default function handler(req,res){
  setNoStore(res);
  if(req.method!=='GET')return res.status(405).end();
  try{
    const origin=siteOrigin();
    const state=randomToken(),nonce=randomToken(),verifier=randomToken(48);
    const url=lineAuthorizationURL({state,nonce,challenge:pkceChallenge(verifier),redirectURI:origin+'/api/auth/line/callback'});
    res.setHeader('Set-Cookie',createOAuthCookie(state,nonce,verifier));
    return res.redirect(302,url);
  }catch(e){console.error('LINE login start:',e.message);return res.status(503).send('登入服務尚未設定完成')}
}
