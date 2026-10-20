import { validLineId } from './access.js';

function clientId(){
  const id=process.env.LINE_LOGIN_CHANNEL_ID;
  if(!/^[0-9]{8,20}$/.test(id||''))throw Error('LINE_LOGIN_CHANNEL_ID missing or invalid');
  return id;
}
function clientSecret(){
  if(!process.env.LINE_LOGIN_CHANNEL_SECRET)throw Error('LINE_LOGIN_CHANNEL_SECRET missing');
  return process.env.LINE_LOGIN_CHANNEL_SECRET;
}
async function sendForm(url,body){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error('LINE authentication rejected ('+response.status+')');
  return data;
}
export function lineAuthorizationURL({state,nonce,challenge,redirectURI}){
  const url=new URL('https://access.line.me/oauth2/v2.1/authorize');
  const params={
    response_type:'code',client_id:clientId(),redirect_uri:redirectURI,
    state,nonce,scope:'openid profile',code_challenge:challenge,code_challenge_method:'S256'
  };
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  return url.toString();
}
export async function exchangeAuthorizationCode(code,redirectURI,verifier){
  const token=await sendForm('https://api.line.me/oauth2/v2.1/token',{
    grant_type:'authorization_code',code,redirect_uri:redirectURI,
    client_id:clientId(),client_secret:clientSecret(),code_verifier:verifier
  });
  if(typeof token.id_token!=='string')throw Error('LINE did not return an ID token');
  return token.id_token;
}
export async function verifyLineIDToken(idToken,nonce){
  if(typeof idToken!=='string'||idToken.length>12000)throw Error('Invalid LINE ID token');
  const data=await sendForm('https://api.line.me/oauth2/v2.1/verify',{
    id_token:idToken,client_id:clientId(),...(nonce?{nonce}:{})
  });
  if(data.aud!==clientId() || data.iss!=='https://access.line.me' || !validLineId(data.sub) ||
      !Number.isFinite(Number(data.exp)) || Number(data.exp)*1000<=Date.now() || 
      (nonce && data.nonce!==nonce))throw Error('LINE identity verification failed');
  return {userId:data.sub,name:typeof data.name==='string'?data.name.slice(0,80):''};
}
