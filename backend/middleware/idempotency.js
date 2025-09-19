'use strict';

// Lightweight idempotency middleware: exposes req.idempotencyKey for routes to use.
// We intentionally do not persist response bodies here to avoid storage dependencies.
// Routes should implement semantic idempotency (e.g., return existing resource if already created).
module.exports = function idempotency(scope = 'default', ttlSeconds = 300) {
  return function (req, _res, next) {
    // Support standard and custom header names
    const key = req.header('Idempotency-Key') || req.header('X-Idempotency-Key') || null;
    req.idempotencyKey = key ? String(key).trim() : null;
    req.idempotencyScope = scope;
    req.idempotencyTtl = ttlSeconds;
    return next();
  };
};
