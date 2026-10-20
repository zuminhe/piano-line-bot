import test from 'node:test';
import assert from 'node:assert/strict';
import {sign,readSigned,createSessionCookie,readSession,pkceChallenge,siteOrigin,createOAuthCookie,readOAuth} from '../lib/session.js';
import {lineAuthorizationURL} from '../lib/line-login.js';
const old={...process.env};
process.env.SESSION_SECRET='test_secret_must_not_be_used_in_production_42';
process.env.STUDENT_BASE_URL='https://student.example.test/';
process.env.LINE_LOGIN_CHANNEL_ID='2009925919';
test('signed session is valid until expiry, rejects tampering',()=>{
 const cookie=createSessionCookie('U'+'a'.repeat(32),'學生');
 const session=readSession({headers:{cookie}});
 assert.equal(session.sub,'U'+'a'.repeat(32));
 assert.equal(session.name,'學生');
 const forged=cookie.replace(/(__Host-piano_session=)([^;])/,(_,prefix,first)=>prefix+(first==='A'?'B':'A'));
 assert.equal(readSession({headers:{cookie:forged}}),null);
});
test('signed OAuth state round-trips',()=>{
 const cookie=createOAuthCookie('state','nonce','verifier');
 const state=readOAuth({headers:{cookie}});
 assert.equal(state.state,'state');
 assert.equal(state.nonce,'nonce');
 assert.equal(state.verifier,'verifier');
});
test('expired signed token is rejected',()=>{
 const past=Date.now()-1000;
 const value=sign({type:'session',sub:'U'+'b'.repeat(32),exp:past});
 assert.equal(readSigned(value,'session'),null);
});
test('redirect is fixed to secure origin and carries PKCE',()=>{
 assert.equal(siteOrigin(),'https://student.example.test');
 const url=new URL(lineAuthorizationURL({state:'abc',nonce:'def',challenge:pkceChallenge('example'),redirectURI:'https://student.example.test/api/auth/line/callback'}));
 assert.equal(url.hostname,'access.line.me');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('scope'),'openid profile');
});
test.after(()=>{for(const key of ['SESSION_SECRET','STUDENT_BASE_URL','LINE_LOGIN_CHANNEL_ID']) {
 if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];
}});
