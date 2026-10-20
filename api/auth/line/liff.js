import {createSessionCookie,siteOrigin,setNoStore} from '../../../lib/session.js';
import {verifyLineIDToken} from '../../../lib/line-login.js';
export default async function handler(req,res){
  setNoStore(res);
  if(req.method!=='POST')return res.status(405).end();
  try {
    const origin=siteOrigin();
    if(req.headers.origin!==origin)return res.status(403).json({error:'Invalid origin'});
    const idToken=req.body?.idToken;
    const profile=await verifyLineIDToken(idToken);
    res.setHeader('Set-Cookie',createSessionCookie(profile.userId,profile.name));
    return res.json({success:true});
  } catch(e) {
    console.error('LIFF verification failed:',e.message);
    return res.status(401).json({error:'LINE 登入驗證失敗'});
  }
}
