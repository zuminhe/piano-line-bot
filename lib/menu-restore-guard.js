// Pure, fail-closed planning for single-user test-menu rollback.
// No function here calls LINE, changes a rich menu, or stores any credentials.
// LINE's GET /v2/bot/user/{userId}/richmenu 404 is ambiguous: it can mean
// no linked menu, non-existent user, or a user who is not an account friend.
const USER = /^U[0-9a-f]{32}$/i;
const MENU = /^richmenu-[0-9a-f]{32}$/i;

export function inspectPersonalMenuResponse(httpStatus, payload) {
  if (httpStatus === 200 && payload && MENU.test(payload.richMenuId)) {
    return { status: 'confirmed_existing', richMenuId: payload.richMenuId };
  }
  if (httpStatus === 404) {
    return { status: 'ambiguous_404', message: 'Cannot infer absence from HTTP 404' };
  }
  return { status: 'unverified', message: 'Refuse to infer current personal menu' };
}

export function prepareOriginalMenuSnapshot({ userId, readResult, createdAt }) {
  if (!USER.test(userId) || readResult?.status !== 'confirmed_existing' ||
      !MENU.test(readResult.richMenuId)) {
    return { status: 'refuse_snapshot' };
  }
  // Snapshot is data only; persistence and integrity verification are required
  // before any real linking operation is added to this system.
  return {
    status: 'prepared',
    snapshot: Object.freeze({
      schemaVersion: 1,
      userId,
      previousPersonalMenuId: readResult.richMenuId,
      createdAt,
      source: 'line_per_user_get_200'
    })
  };
}

export function planRestoration({ snapshot, actualUserId, currentMenuResponse, ownTestMenuId }) {
  if (snapshot?.schemaVersion !== 1 || snapshot.source !== 'line_per_user_get_200' ||
    !USER.test(actualUserId) || actualUserId !== snapshot.userId ||
    !MENU.test(snapshot.previousPersonalMenuId) || !MENU.test(ownTestMenuId) ||
    snapshot.previousPersonalMenuId === ownTestMenuId) {
    return { status: 'refuse_restore' };
  }
  const current = inspectPersonalMenuResponse(currentMenuResponse?.status, currentMenuResponse?.body);
  if (current.status !== 'confirmed_existing' || current.richMenuId !== ownTestMenuId) {
    return { status: 'refuse_restore', reason: 'User menu changed or cannot be verified' };
  }
  return { status: 'ready_to_relink_original', userId: actualUserId,
    richMenuId: snapshot.previousPersonalMenuId };
}
