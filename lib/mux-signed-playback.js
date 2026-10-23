import crypto from 'node:crypto';

// These credentials sign JWTs; they are NOT the Mux API access token.
// Signing credentials must remain in server-only Vercel env variables.
export const MUX_PLAYBACK_ID=/^[A-Za-z0-9]{10,128}$/;
export const MUX_TOKEN_TTL_SECONDS=2*60*60;

export function muxSigningConfigured(env=process.env){
 return env.MUX_SIGNED_PLAYBACK_ENABLED==='enabled'&&
   typeof env.MUX_SIGNING_KEY_ID==='string'&&
   /^[A-Za-z0-9_-]{8,200}$/.test(env.MUX_SIGNING_KEY_ID)&&
   typeof env.MUX_SIGNING_PRIVATE_KEY_BASE64==='string'&&
   env.MUX_SIGNING_PRIVATE_KEY_BASE64.length>=500;
}
export function signMuxPlayback(playbackId,{env=process.env,now=Date.now()}={}){
 if(!MUX_PLAYBACK_ID.test(playbackId||''))throw new Error('INVALID_MUX_PLAYBACK_ID');
 if(!muxSigningConfigured(env))throw new Error('MUX_NOT_CONFIGURED');
 const nowSeconds=Math.floor(now/1000),expiresAt=nowSeconds+MUX_TOKEN_TTL_SECONDS;
 let pem,key;
 try{
  pem=Buffer.from(env.MUX_SIGNING_PRIVATE_KEY_BASE64,'base64').toString('utf8');
  if(!pem.startsWith('-----BEGIN ')||!pem.includes('PRIVATE KEY-----'))throw Error('Invalid PEM');
  key=crypto.createPrivateKey(pem);
  if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength||0)<2048)throw Error('RSA 2048 or higher required');
 }catch{
  throw new Error('MUX_SIGNING_KEY_INVALID');
 }
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const header=b64({alg:'RS256',typ:'JWT',kid:env.MUX_SIGNING_KEY_ID});
 const sign=aud=>{
  const payload=b64({sub:playbackId,aud,exp:expiresAt,iat:nowSeconds});
  const input=header+'.'+payload;
  const sig=crypto.sign('RSA-SHA256',Buffer.from(input),key).toString('base64url');
  return input+'.'+sig;
 };
 return {provider:'mux',playbackId,expiresAt:new Date(expiresAt*1000).toISOString(),
  tokens:{playback:sign('v'),thumbnail:sign('t'),storyboard:sign('s')}};
}
