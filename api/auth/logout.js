import {clearSessionCookie,setNoStore,siteOrigin} from '../../lib/session.js';
export default function handler(req,res){
  setNoStore(res);
  if(req.method!=='POST')return res.status(405).end();
  try{
    if(req.headers.origin!==siteOrigin())return res.status(403).json({error:'Invalid origin'});
    res.setHeader('Set-Cookie',clearSessionCookie());
    return res.json({success:true});
  }catch{return res.status(503).json({error:'Server not configured'})}
}
