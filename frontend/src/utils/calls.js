export function parseDomainHost(fullUrl) {
  try {
    const u = new URL(fullUrl);
    return u.origin; // includes protocol + host[:port]
  } catch (_) { return null; }
}

export function buildLocalJoin(roomId, token, domainHost, sessionId, expiresAt) {
  const base = window.location.origin.replace(/\/$/, '');
  const d = encodeURIComponent(domainHost);
  const jwt = encodeURIComponent(token);
  const sid = encodeURIComponent(sessionId);
  const exp = encodeURIComponent(expiresAt);
  return `${base}/calls/${encodeURIComponent(roomId)}?jwt=${jwt}&d=${d}&sid=${sid}&exp=${exp}`;
}

export function linksFromCreateResponse(res) {
  const { id: sessionId, roomId, hostUrl, guestUrl, expiresAt } = res || {};
  if (!sessionId || !roomId || !hostUrl || !guestUrl) throw new Error('bad-response');
  const domainHost = parseDomainHost(hostUrl);
  const hostToken = new URL(hostUrl).searchParams.get('jwt');
  const guestToken = new URL(guestUrl).searchParams.get('jwt');
  const hostLocal = buildLocalJoin(roomId, hostToken, domainHost, sessionId, expiresAt);
  const guestLocal = buildLocalJoin(roomId, guestToken, domainHost, sessionId, expiresAt);
  return { sessionId, hostUrl: hostLocal, guestUrl: guestLocal, expiresAt };
}
