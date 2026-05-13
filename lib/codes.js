import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// 產生 8 碼大寫英數字驗證碼
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 儲存驗證碼
export async function saveCode(data) {
  const { code } = data;
  await redis.set(`code:${code}`, JSON.stringify(data));
  await redis.lpush('codes:all', code);
}

// 驗證碼查詢
export async function validateCode(code) {
  const raw = await redis.get(`code:${code}`);
  if (!raw) return { valid: false };
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    valid: true,
    used: data.used,
    plan: data.plan,
    planName: data.planName,
    richMenuId: data.richMenuId,
    data,
  };
}

// 標記已使用
export async function markCodeUsed(code, userId) {
  const raw = await redis.get(`code:${code}`);
  if (!raw) return;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  data.used = true;
  data.usedBy = userId;
  data.usedAt = new Date().toISOString();
  await redis.set(`code:${code}`, JSON.stringify(data));
}

// 取得驗證碼資訊
export async function getCodeInfo(code) {
  const raw = await redis.get(`code:${code}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// 列出所有驗證碼
export async function getAllCodes() {
  const codeKeys = await redis.lrange('codes:all', 0, -1);
  if (!codeKeys || codeKeys.length === 0) return [];
  const results = await Promise.all(
    codeKeys.map(async (code) => {
      const raw = await redis.get(`code:${code}`);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    })
  );
  return results.filter(Boolean).reverse();
}
