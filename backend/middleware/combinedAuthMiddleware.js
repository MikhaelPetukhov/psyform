const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'Нет токена, авторизация отклонена' });
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ msg: 'Server configuration error' });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.user) {
      req.user = decoded.user; // admin
      req.authRole = 'admin';
    }
    if (decoded.client) {
      req.client = decoded.client; // client
      req.authRole = 'client';
    }
    if (!req.user && !req.client) {
      return res.status(401).json({ msg: 'Некорректный токен' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Токен недействителен' });
  }
};
