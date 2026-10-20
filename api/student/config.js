import {setNoStore,siteOrigin} from '../../lib/session.js';
export default function handler(req,res){
 setNoStore(res);
 if(req.method!=='GET')return res.status(405).end();
 try{
   const base=siteOrigin();
   return res.json({base, liffId:process.env.LINE_LIFF_ID || null});
 }catch{return res.status(503).json({error:'尚未設定學員網址'})}
}
