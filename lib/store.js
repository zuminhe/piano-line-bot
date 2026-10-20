import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { effectiveAccess, PLANS, validateGrant, validLineId } from './access.js';

const db = Redis.fromEnv();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL_SECONDS = 7 * 24 * 60 * 60;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
const hash = code => crypto.createHash('sha256').update(code).digest('hex');
const asObject = raw => typeof raw === 'string' ? JSON.parse(raw) : raw;

export function isCode(text) { return CODE_PATTERN.test(text); }
export function createRandomCode() {
  return Array.from({length: 8}, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
}
export async function issueCode({ plan, expiresAt = null, orderId = null, lineUserId = null, note = '' }) {
  const spec = validateGrant(plan, expiresAt);
  if (lineUserId && !validLineId(lineUserId)) throw new Error('Invalid LINE user ID');
  for (let attempt=0; attempt<5; attempt++) {
    const code = createRandomCode();
    const key = 'voucher:' + hash(code);
    const data = { plan, entitlements: spec.entitlements, expiresAt, orderId, intendedLineUserId: lineUserId,
      note: String(note).slice(0,120), issuedAt: new Date().toISOString() };
    if (await db.set(key, JSON.stringify(data), { nx: true, ex: TTL_SECONDS }) === 'OK') {
      // Only a digest appears in Redis. The plaintext code is returned once to the operator.
      await db.lpush('vouchers:index', JSON.stringify({ id: hash(code), plan, orderId, note: data.note, issuedAt: data.issuedAt }));
      await db.ltrim('vouchers:index', 0, 499);
      return { code, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(), plan };
    }
  }
  throw new Error('Unable to create code');
}
export async function redeemCode(code, userId) {
  if (!validLineId(userId)) return { status: 'invalid' };
  const attemptsKey = 'voucher:attempts:' + userId;
  const attempts = await db.incr(attemptsKey);
  if (attempts === 1) await db.expire(attemptsKey, 3600);
  if (attempts > 12) return { status: 'rate_limited' };
  const key = 'voucher:' + hash(code);
  // Atomic consumption prevents the same code being redeemed by two people.
  const script = `local s=redis.call('GET',KEYS[1])
if not s then return '' end
local item=cjson.decode(s)
if item.intendedLineUserId and item.intendedLineUserId ~= ARGV[1] then return 'BOUND' end
redis.call('DEL',KEYS[1])
return s`;
  const raw = await db.eval(script, [key], [userId]);
  if (raw === 'BOUND') return { status: 'bound' };
  if (!raw) return { status: 'invalid' };
  const voucher = asObject(raw);
  try {
    const grant = await addGrant(userId, { plan: voucher.plan, expiresAt: voucher.expiresAt,
      source: 'voucher', orderId: voucher.orderId, note: voucher.note,
      id: 'voucher:' + hash(code) });
    return { status: 'ok', grant };
  } catch (error) {
    // Preserves code for recovery if Redis mutation fails after atomic claim.
    await db.set('voucher:failed:' + hash(code), JSON.stringify({ userId, voucher }), { ex: 30 * 86400 });
    throw error;
  }
}
export async function addGrant(userId, { plan, expiresAt = null, source = 'manual', orderId = null, note = '', id } ) {
  if (!validLineId(userId)) throw new Error('Invalid LINE user ID');
  const spec = validateGrant(plan, expiresAt);
  const grant = { id: id || 'manual:' + crypto.randomUUID(), plan, label: spec.label,
    entitlements: spec.entitlements, expiresAt, source, orderId, note: String(note).slice(0,120),
    createdAt: new Date().toISOString(), status: 'active' };
  await db.hset('member:' + userId + ':grants', { [grant.id]: JSON.stringify(grant) });
  await db.sadd('members:index', userId);
  return grant;
}
export async function memberGrants(userId) {
  if (!validLineId(userId)) throw new Error('Invalid LINE user ID');
  const raw = await db.hgetall('member:' + userId + ':grants') || {};
  return Object.values(raw).map(asObject).filter(Boolean);
}
export async function memberSummary(userId) {
  const grants = await memberGrants(userId);
  return { userId, access: effectiveAccess(grants), grants };
}
export async function revokeGrant(userId, id) {
  if (!validLineId(userId) || typeof id !== 'string' || !/^(manual:|voucher:)[a-z0-9-]+$/.test(id)) {
    throw new Error('Invalid grant');
  }
  const key = 'member:' + userId + ':grants';
  const raw = await db.hget(key, id);
  if (!raw) return false;
  const grant = asObject(raw);
  grant.status = 'revoked';
  grant.revokedAt = new Date().toISOString();
  await db.hset(key, { [id]: JSON.stringify(grant) });
  return true;
}
export async function listMembers() {
  const ids = await db.smembers('members:index') || [];
  return Promise.all(ids.slice(0, 250).map(memberSummary));
}
export async function listVoucherHistory() {
  const rows = await db.lrange('vouchers:index',0,99) || [];
  return rows.map(asObject);
}
export { PLANS };
