'use strict';

const practitionerCache = require('../utils/practitionerCache');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

// Centralized practitioner resolution logic
// Priority order:
// 1) Admin JWT token practitionerId (strict enforcement for authenticated admins)
// 2) x-practitioner-id header (direct ID)
// 3) x-practitioner-slug header (DB lookup by slug)
// 4) x-practitioner-public-slug header (DB lookup by publicSlug)
// 5) req.user.practitionerId (from client auth middleware)
// 6) DEFAULT_PRACTITIONER_ID or DEFAULT_PRACTITIONER_SLUG environment variables
module.exports = async function practitionerScope(req, res, next) {
  try {
    let practitionerId = null;

    // 0a) На клиентских Telegram-эндпоинтах отдаём приоритет клиентскому токену,
    // чтобы не конфликтовать с админской сессией, если обе открыты в одном браузере.
    try {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith('/api/auth/tg')) {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          let ctoken = null;
          if (req.cookies) ctoken = req.cookies.client_sid || req.cookies.sid || null;
          if (!ctoken) ctoken = req.header('x-auth-token');
          if (ctoken) {
            try {
              const decoded = jwt.verify(ctoken, jwtSecret);
              if (decoded && decoded.client && decoded.client.practitionerId) {
                req.practitionerId = decoded.client.practitionerId;
                req.user = { id: decoded.client.id, role: 'client', practitionerId: decoded.client.practitionerId };
                logger.debug(`[scope] client token bound to practitionerId=${req.practitionerId} for ${req.method} ${req.originalUrl}`);
                return next();
              }
            } catch (_) { /* ignore invalid client token */ }
          }
        }
      }
    } catch (_) { /* ignore */ }

    // 0) If admin JWT is present, enforce practitionerId strictly from token
    // BUT allow explicit public headers to override for this request (public pages running in same browser)
    try {
      let token = req.header('x-auth-token');
      if (!token && req.cookies) {
        token = req.cookies.admin_sid || req.cookies.sid_admin || null;
      }
      if (token) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT_SECRET not configured');
        }
        const decoded = jwt.verify(token, jwtSecret);
        const user = decoded && decoded.user;
        if (user && ['admin', 'super_admin'].includes(user.role)) {
          if (!user.practitionerId) {
            // Public override via headers: if user is on public form and explicitly provided
            // tenant headers, prefer them over admin token for this request only.
            try {
              const hdrId = req.header('x-practitioner-id');
              const hdrSlug = req.header('x-practitioner-slug');
              const hdrPublic = req.header('x-practitioner-public-slug');
              let overrideId = null;
              if (hdrId) {
                const idVal = String(hdrId).trim();
                const exists = await practitionerCache.getById(idVal);
                overrideId = exists ? exists.id : null;
                if (overrideId) {
                  logger.debug(`[scope] override via header x-practitioner-id=${hdrId} -> ${overrideId} (admin present)`);
                } else {
                  logger.warn(`[scope] override via header x-practitioner-id=${hdrId} not found`);
                }
              } else if (hdrSlug) {
                const p = await practitionerCache.getBySlug(String(hdrSlug).trim());
                overrideId = p ? p.id : null;
                logger.debug(`[scope] override via header x-practitioner-slug=${hdrSlug} -> ${overrideId} (admin present)`);
              } else if (hdrPublic) {
                const p = await practitionerCache.getByPublicSlug(String(hdrPublic).trim());
                overrideId = p ? p.id : null;
                logger.debug(`[scope] override via header x-practitioner-public-slug=${hdrPublic} -> ${overrideId} (admin present)`);
              }
              if (overrideId) {
                req.practitionerId = overrideId;
                return next();
              }
            } catch (e) {
              logger.warn(`[scope] override resolve error: ${e.message}`);
            }
          }

          if (user.practitionerId) {
            // Verify practitioner exists (DB could be reset)
            const exists = await practitionerCache.getById(user.practitionerId);
            if (exists) {
              req.practitionerId = user.practitionerId;
              logger.debug(`[scope] admin token bound to practitionerId=${user.practitionerId} for ${req.method} ${req.originalUrl}`);
            } else {
              req.practitionerId = null;
              req.__adminMissingTenant = true;
              logger.warn(`[scope] admin token has missing tenant practitionerId=${user.practitionerId}; proceeding without tenant for ${req.method} ${req.originalUrl}`);
            }
          } else {
            // Mark that admin is authenticated but not bound to any practitioner
            req.practitionerId = null;
            req.__adminMissingTenant = true;
            logger.warn(`[scope] admin token without practitionerId; attempting header fallback; ${req.method} ${req.originalUrl}`);

            // Fallback: allow admin to specify practitioner via headers just for this request
            const hdrId = req.header('x-practitioner-id');
            const hdrSlug = req.header('x-practitioner-slug');
            const hdrPublic = req.header('x-practitioner-public-slug');
            let fallbackId = null;
            try {
              if (hdrId) {
                const idVal = String(hdrId).trim();
                const exists = await practitionerCache.getById(idVal);
                fallbackId = exists ? exists.id : null;
                if (fallbackId) {
                  logger.debug(`[scope] (admin fallback) x-practitioner-id=${hdrId} -> ${fallbackId}`);
                } else {
                  logger.warn(`[scope] (admin fallback) x-practitioner-id=${hdrId} not found`);
                }
              } else if (hdrSlug) {
                const p = await practitionerCache.getBySlug(String(hdrSlug).trim());
                fallbackId = p ? p.id : null;
                logger.debug(`[scope] (admin fallback) x-practitioner-slug=${hdrSlug} -> ${fallbackId}`);
              } else if (hdrPublic) {
                const p = await practitionerCache.getByPublicSlug(String(hdrPublic).trim());
                fallbackId = p ? p.id : null;
                logger.debug(`[scope] (admin fallback) x-practitioner-public-slug=${hdrPublic} -> ${fallbackId}`);
              }
            } catch (e) {
              logger.error(`[scope] (admin fallback) header resolve error: ${e.message}`);
            }
            if (fallbackId) {
              req.practitionerId = fallbackId;
              req.__adminMissingTenantFromHeader = true;
              logger.warn(`[scope] (admin fallback) using practitionerId=${fallbackId} for current request only`);
            }
          }
          return next();
        }
      }
    } catch (_) { /* ignore decode errors and continue with public/client resolution */ }

    // Public/Client resolution path (headers are acceptable here)
    const hdrId = req.header('x-practitioner-id');
    const hdrSlug = req.header('x-practitioner-slug');
    const hdrPublic = req.header('x-practitioner-public-slug');

    if (hdrId) {
      practitionerId = hdrId;
      logger.debug(`[scope] resolved via x-practitioner-id=${hdrId} for ${req.method} ${req.originalUrl}`);
    } else if (hdrSlug) {
      const val = String(hdrSlug).trim();
      let p = await practitionerCache.getBySlug(val);
      if (!p) {
        // Фолбэк: если не нашли по slug, попробуем publicSlug тем же значением
        p = await practitionerCache.getByPublicSlug(val);
        if (p) {
          logger.debug(`[scope] resolved via x-practitioner-slug=${val} (fallback to publicSlug) -> ${p.id} for ${req.method} ${req.originalUrl}`);
        }
      }
      practitionerId = p ? p.id : null;
      if (p) {
        logger.debug(`[scope] resolved via x-practitioner-slug=${val} -> ${practitionerId} for ${req.method} ${req.originalUrl}`);
      } else {
        logger.warn(`[scope] x-practitioner-slug=${val} not found as slug or publicSlug`);
      }
    } else if (hdrPublic) {
      const val = String(hdrPublic).trim();
      let p = await practitionerCache.getByPublicSlug(val);
      if (!p) {
        // Фолбэк: если не нашли по publicSlug, пробуем обычный slug
        p = await practitionerCache.getBySlug(val);
        if (p) {
          logger.debug(`[scope] resolved via x-practitioner-public-slug=${val} (fallback to slug) -> ${p.id} for ${req.method} ${req.originalUrl}`);
        }
      }
      practitionerId = p ? p.id : null;
      if (p) {
        logger.debug(`[scope] resolved via x-practitioner-public-slug=${val} -> ${practitionerId} for ${req.method} ${req.originalUrl}`);
      } else {
        logger.warn(`[scope] x-practitioner-public-slug=${val} not found as publicSlug or slug`);
      }
    } else if (req.user && req.user.practitionerId) {
      // For client tokens decoded by other middleware
      practitionerId = req.user.practitionerId;
      logger.debug(`[scope] resolved via client token practitionerId=${practitionerId} for ${req.method} ${req.originalUrl}`);
    } else if (process.env.DEFAULT_PRACTITIONER_ID) {
      practitionerId = process.env.DEFAULT_PRACTITIONER_ID;
      logger.debug(`[scope] resolved via DEFAULT_PRACTITIONER_ID=${practitionerId} for ${req.method} ${req.originalUrl}`);
    } else if (process.env.DEFAULT_PRACTITIONER_SLUG) {
      const p = await practitionerCache.getBySlug(String(process.env.DEFAULT_PRACTITIONER_SLUG).trim());
      practitionerId = p ? p.id : null;
      logger.debug(`[scope] resolved via DEFAULT_PRACTITIONER_SLUG=${process.env.DEFAULT_PRACTITIONER_SLUG} -> ${practitionerId} for ${req.method} ${req.originalUrl}`);
    }

    req.practitionerId = practitionerId || null;
    if (!req.practitionerId) {
      logger.warn(`[scope] practitionerId unresolved for ${req.method} ${req.originalUrl}`);
    }
    return next();
  } catch (e) {
    req.practitionerId = null;
    logger.error(`[scope] error resolving practitioner: ${e.message}`);
    return next();
  }
};
