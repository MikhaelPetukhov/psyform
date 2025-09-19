const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header first
  let token = req.header('x-auth-token');
  // Fallback to cookies (admin magic-link may set httpOnly cookie)
  if (!token && req.cookies) {
    token = req.cookies.admin_sid || req.cookies.sid_admin || req.cookies.sid || null;
  }

  // Check if no token was provided
  if (!token) {
    return res.status(401).json({ msg: 'Нет токена, авторизация отклонена' });
  }

  // Verify token
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ msg: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Токен недействителен' });
  }
};
