import {readSession,setNoStore} from '../../lib/session.js';
import {memberSummary} from '../../lib/store.js';
export default async function handler(req,res){
  setNoStore(res);
  if(req.method!=='GET')return res.status(405).end();
  const identity=readSession(req);
  if(!identity)return res.status(401).json({error:'LOGIN_REQUIRED'});
  try{
    const summary=await memberSummary(identity.sub);
    // Never send internal grants, order numbers or Redis entries to browser.
    return res.json({name:identity.name,access:summary.access});
  } catch(e){
    console.error('Student membership unavailable:',e.message);
    return res.status(503).json({error:'會員資料暫時無法讀取'});
  }
}
