// Safely prepares ONE unlinked, non-default LINE rich menu for a single-user test.
// Creating this definition makes NO requests to LINE. Only area A is clickable.
const LIFF_ID_PATTERN = /^\d{6,20}-[A-Za-z0-9]+$/;

export function buildSingleUserTestMenu(liffId) {
  if (typeof liffId !== 'string' || !LIFF_ID_PATTERN.test(liffId)) {
    throw new Error('Invalid LIFF ID');
  }
  return {
    size: { width: 2500, height: 1686 },
    selected: false,
    name: 'Piano-student-staging-one-user-test',
    chatBarText: '測試選單',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: {
          type: 'uri',
          label: '我的課程',
          uri: 'https://liff.line.me/' + liffId
        }
      }
    ]
  };
}

// Pure decision helper for restoring the previous *personal* rich menu.
// Actual restoration requires first capturing and persisting the real user's
// pre-test personal menu, and verifying the currently linked menu is OUR test ID.
export function restoreIntent(previousRichMenuId) {
  if (previousRichMenuId === null) return {action: 'unlink_test_menu'};
  if (typeof previousRichMenuId === 'string' && /^richmenu-[0-9a-f]{32}$/i.test(previousRichMenuId)) {
    return {action:'relink_previous_menu',richMenuId:previousRichMenuId};
  }
  return {action:'refuse_unsafe_restore'};
}
