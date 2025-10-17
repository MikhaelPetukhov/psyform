const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { CallSession, JoinToken, CallLog, Booking } = require('../models');

function clampTtlMinutes(ttl) {
  const n = Number.isFinite(ttl) ? Math.max(1, Math.min(90, Math.floor(ttl))) : 90;
  return n;
}

function randomRoomId() {
  return `pf-${crypto.randomBytes(6).toString('hex')}`;
}

function buildJwt(roomId, role, expiresAt) {
  const aud = process.env.JITSI_JWT_AUD || 'psyform-calls';
  const iss = process.env.JITSI_JWT_ISS || 'psyform-backend';
  const sub = process.env.JITSI_XMPP_DOMAIN || 'meet.jitsi';
  const alg = (process.env.JITSI_JWT_ALG || 'HS256').toUpperCase();
  const expSec = Math.floor(new Date(expiresAt).getTime() / 1000);
  const payload = {
    aud,
    iss,
    sub,
    room: roomId,
    exp: expSec,
    context: { user: { role } },
  };

  if (alg === 'RS256') {
    const kid = (process.env.JITSI_JWT_KID || '').trim() || undefined;
    const keyFile = (process.env.JITSI_JWT_PRIVATE_KEY_FILE || '').trim();
    let privateKey = process.env.JITSI_JWT_PRIVATE_KEY || '';
    if (!privateKey.trim() && keyFile) {
      try { privateKey = fs.readFileSync(keyFile, 'utf8'); } catch (e) { throw new Error('Failed to read JITSI_JWT_PRIVATE_KEY_FILE: ' + e.message); }
    }
    if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    if (!privateKey.trim()) throw new Error('JITSI_JWT_PRIVATE_KEY is not set for RS256');
    const signOpts = { algorithm: 'RS256' };
    if (kid) signOpts.keyid = kid;
    return jwt.sign(payload, privateKey, signOpts);
  }

  // default HS256
  const secret = process.env.JITSI_JWT_APP_SECRET;
  if (!secret) throw new Error('JITSI_JWT_APP_SECRET is not set');
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

function buildJoinUrl(roomId, token) {
  const base = process.env.PUBLIC_URL || 'https://jitsi.localhost:8443';
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(roomId)}?jwt=${encodeURIComponent(token)}`;
}

async function createSession({ bookingId = null, hostId = null, clientId = null, practitionerId, ttlMinutes = 90 }) {
  const ttl = clampTtlMinutes(ttlMinutes);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);
  const roomId = randomRoomId();

  return await sequelize.transaction(async (t) => {
    const session = await CallSession.create({
      roomId,
      hostId: hostId || null,
      clientId: clientId || null,
      bookingId: bookingId || null,
      practitionerId,
      startAt: now,
      expiresAt,
      status: 'created',
    }, { transaction: t });

    const hostJwt = buildJwt(roomId, 'host', expiresAt);
    const guestJwt = buildJwt(roomId, 'guest', expiresAt);

    await JoinToken.bulkCreate([
      { sessionId: session.id, userId: hostId || null, role: 'host', jwt: hostJwt, expiresAt },
      { sessionId: session.id, userId: clientId || null, role: 'guest', jwt: guestJwt, expiresAt },
    ], { transaction: t });

    return {
      session,
      host: { token: hostJwt, url: buildJoinUrl(roomId, hostJwt) },
      guest: { token: guestJwt, url: buildJoinUrl(roomId, guestJwt) },
    };
  });
}

async function closeSession(sessionId) {
  const s = await CallSession.findByPk(sessionId);
  if (!s) return null;
  await s.update({ status: 'ended' });
  return s;
}

async function sweepExpiredSessions() {
  const now = new Date();
  await CallSession.update({ status: 'expired' }, { where: { expiresAt: { [Op.lt]: now }, status: { [Op.notIn]: ['ended', 'expired'] } } });
}

function scheduleExpirySweep() {
  const enabled = String(process.env.ENABLE_CALLS_SWEEP || 'true').toLowerCase() === 'true';
  if (!enabled) return;
  setInterval(() => { sweepExpiredSessions().catch(() => {}); }, 60 * 1000);
}

function hashUserId(userId) {
  const salt = process.env.CALL_LOG_SALT || 'call-log-salt-dev';
  return crypto.createHash('sha256').update(String(userId || '') + '|' + salt).digest('hex');
}

async function logEvent(sessionId, event, userId = null, metadata = null, ts = null) {
  const timestamp = ts ? new Date(ts) : new Date();
  return CallLog.create({ sessionId, event, userHash: userId ? hashUserId(userId) : null, timestamp, metadata: metadata || null });
}

async function resolveBookingContext(bookingId, practitionerId) {
  if (!bookingId) return { clientId: null };
  const b = await Booking.findOne({ where: { id: bookingId, practitionerId } });
  if (!b) return { clientId: null };
  return { clientId: b.clientId || null };
}

function buildWebJoinUrl(roomId, token, sessionId, expiresAt) {
  try {
    const webBase = (process.env.PUBLIC_WEB_URL || '').trim();
    const jitsiBase = (process.env.PUBLIC_URL || '').trim();
    if (!webBase || !jitsiBase) return buildJoinUrl(roomId, token);
    const jitsiHost = new URL(jitsiBase).host; // includes port if any
    const base = webBase.replace(/\/$/, '');
    const params = new URLSearchParams({ jwt: token, d: jitsiHost, sid: String(sessionId), exp: new Date(expiresAt).toISOString() });
    return `${base}/calls/${encodeURIComponent(roomId)}?${params.toString()}`;
  } catch (_) {
    return buildJoinUrl(roomId, token);
  }
}

async function ensureGuestTokenLink(sessionId, clientId = null) {
  const session = await CallSession.findByPk(sessionId);
  if (!session) throw new Error('session_not_found');
  const now = new Date();
  if (session.expiresAt && session.expiresAt < now) throw new Error('session_expired');

  let tokenRow = await JoinToken.findOne({ where: { sessionId: session.id, role: 'guest', userId: clientId || null } });
  if (!tokenRow) {
    const jwtToken = buildJwt(session.roomId, 'guest', session.expiresAt);
    tokenRow = await JoinToken.create({ sessionId: session.id, userId: clientId || null, role: 'guest', jwt: jwtToken, expiresAt: session.expiresAt });
  }
  const jitsiUrl = buildJoinUrl(session.roomId, tokenRow.jwt);
  const webUrl = buildWebJoinUrl(session.roomId, tokenRow.jwt, session.id, session.expiresAt);
  return { url: webUrl, token: tokenRow.jwt, roomId: session.roomId, expiresAt: session.expiresAt, jitsiUrl };
}

module.exports = {
  createSession,
  closeSession,
  scheduleExpirySweep,
  sweepExpiredSessions,
  logEvent,
  resolveBookingContext,
  ensureGuestTokenLink,
};
