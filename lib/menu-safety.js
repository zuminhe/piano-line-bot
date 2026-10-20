// Fail-closed guard for rich menu writes to the REAL LINE Official Account.
// A staging deployment must never modify arbitrary users' personal menus.
const LINE_USER_ID = /^U[0-9a-f]{32}$/i;
const RICH_MENU_ID = /^richmenu-[0-9a-f]{32}$/i;

export function menuWritePermission(userId, env = process.env) {
  // Merely configuring a LINE token or a menu ID must never enable writes.
  if (env.RICH_MENU_TEST_MODE !== 'enabled') return 'disabled';
  // Exactly one designated user; do not accept a comma-separated list or wildcard.
  const designatedUser = env.RICH_MENU_TEST_USER_ID;
  if (typeof designatedUser !== 'string' || !LINE_USER_ID.test(designatedUser)) {
    return 'test_user_not_configured';
  }
  if (!LINE_USER_ID.test(userId) || userId !== designatedUser) return 'not_allowed';
  return 'allowed';
}

export function menuIdForAccess(access, env = process.env) {
  if (!access || typeof access !== 'object') return { status: 'invalid_access' };
  const id = access.coaching ? env.RICH_MENU_COACHING
    : access.hasCourse ? env.RICH_MENU_MEMBER : env.RICH_MENU_GUEST;
  // In particular, never silently DELETE a user's existing rich menu when
  // RICH_MENU_GUEST is missing after a grant is revoked.
  if (!id) return { status: 'not_configured' };
  if (typeof id !== 'string' || !RICH_MENU_ID.test(id)) {
    return { status: 'invalid_menu_id' };
  }
  return { status: 'ready', id };
}
