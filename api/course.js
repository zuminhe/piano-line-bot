// Hobby plan: six logical routes share one Serverless Function.
// Every route retains its original auth/entitlement checks.
import {serveStudentUnit} from '../lib/http/student-unit.js';
import {serveStudentLesson} from '../lib/http/student-lesson.js';
import {serveStudentProgress} from '../lib/http/student-progress.js';
import {serveStudentPlayback} from '../lib/http/student-playback.js';
import checkoutQuote from '../lib/http/checkout-quote.js';
import {serveCheckoutDraft} from '../lib/http/checkout-draft.js';
const operations=Object.freeze({
 unit:serveStudentUnit,lesson:serveStudentLesson,progress:serveStudentProgress,
 playback:serveStudentPlayback,quote:checkoutQuote,draft:serveCheckoutDraft
});
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const op=typeof req.query?.operation==='string'?req.query.operation:'';
 if(!Object.hasOwn(operations,op))return res.status(404).json({error:'ROUTE_NOT_FOUND'});
 return operations[op](req,res);
}
