// Central source of truth: purchases grant entitlements, menus never grant access.
export const PLANS = Object.freeze({
  course_full: { label: '完整學習組', entitlements: ['unit:1','unit:2','unit:3','unit:4'] },
  course_basic: { label: '基礎入門組', entitlements: ['unit:1','unit:2'] },
  course_advanced: { label: '伴奏進階組', entitlements: ['unit:3','unit:4'] },
  coaching_month: { label: '陪練訂閱', entitlements: ['coaching'], requiresExpiry: true },
  unit_1: { label: '單元一（管理員補開）', entitlements: ['unit:1'] },
  unit_2: { label: '單元二（管理員補開）', entitlements: ['unit:2'] },
  unit_3: { label: '單元三（管理員補開）', entitlements: ['unit:3'] },
  unit_4: { label: '單元四（管理員補開）', entitlements: ['unit:4'] }
});
export function validLineId(value) {
  return typeof value === 'string' && /^U[0-9a-f]{32}$/i.test(value);
}
export function validateGrant(plan, expiresAt) {
  const spec = PLANS[plan];
  if (!spec) throw new Error('Unknown plan');
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
    throw new Error('Expiry must be a future ISO date');
  }
  if (spec.requiresExpiry && !expiresAt) throw new Error('Subscription expiry is required');
  return spec;
}
export function effectiveAccess(grants, at = Date.now()) {
  const entitlements = new Set();
  for (const grant of grants) {
    if (!grant || grant.status === 'revoked') continue;
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= at) continue;
    for (const entitlement of grant.entitlements || []) entitlements.add(entitlement);
  }
  const units = [1,2,3,4].filter(n => entitlements.has('unit:' + n));
  return { units, coaching: entitlements.has('coaching'), hasCourse: units.length > 0 };
}
