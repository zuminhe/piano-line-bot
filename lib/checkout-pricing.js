// PRICE CONFIGURATION: only full package has a previously discussed planned price.
// All values are server-controlled; never trust a client-submitted amount.
export const PLANS_FOR_SALE=Object.freeze({
 course_full:{label:'完整學習組',units:[1,2,3,4],amountTwd:3000},
 course_basic:{label:'基礎入門組',units:[1,2],amountTwd:null},
 course_advanced:{label:'伴奏進階組',units:[3,4],amountTwd:null}
});
export function quotePlan(plan){
 const entry=PLANS_FOR_SALE[plan];
 if(!entry)return null;
 return {plan,label:entry.label,units:[...entry.units],currency:'TWD',
  amount:entry.amountTwd,priceConfirmed:false,checkoutEnabled:false};
}
// Do not treat a client, redirect URL or unverified callback as proof of payment.
// Provider-specific signed verification, order query and reconciliation must be
// implemented before payment success could result in a voucher/grant.
export function verifiedPaymentMatches(order,event){
 if(!order||!event||order.status!=='awaiting_verified_payment')return false;
 return event.verifiedByProvider===true&&event.orderId===order.id&&
  event.amount===order.amount&&event.currency===order.currency&&
  typeof event.transactionId==='string'&&event.transactionId.length>=6&&
  event.provider===order.provider&&['newebpay','ecpay'].includes(event.provider);
}
