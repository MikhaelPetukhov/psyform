'use strict';

// Require that the JWT is an admin token issued by /api/auth/login
// We consider it admin if authMiddleware decoded payload contains `user`
// (client tokens from /api/auth/tg/verify contain `client` instead)
module.exports = function adminOnly(req, res, next) {
  if (!req.user) {
    // For tests we treat unauthenticated as forbidden in admin section
    return res.status(403).json({ msg: 'Недостаточно прав. Требуется роль администратора.' });
  }
  const role = req.user.role;
  if (!role || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ msg: 'Недостаточно прав. Требуется роль администратора.' });
  }
  return next();
};
