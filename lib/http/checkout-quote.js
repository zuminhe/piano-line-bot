import {quotePlan} from '../checkout-pricing.js';
import {setNoStore} from '../session.js';

export default function handler(req,res){
 setNoStore(res);res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const plan=typeof req.query?.plan==='string'?req.query.plan:null;
 const quote=quotePlan(plan);
 if(!quote)return res.status(404).json({error:'UNKNOWN_PLAN'});
 return res.json({quote,workflow:'checkout_not_connected',message:'目前尚未開放購買；不會收款或開通課程。'});
}
