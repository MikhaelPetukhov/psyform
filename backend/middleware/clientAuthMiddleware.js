const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // 1) Пытаемся взять из HttpOnly cookie `client_sid`
  let token = (req.cookies && (req.cookies.client_sid || req.cookies.sid)) ? (req.cookies.client_sid || req.cookies.sid) : null;
  // 2) Fallback: из заголовка x-auth-token
  if (!token) token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'Нет токена клиента, авторизация через Telegram обязательна' });
  }
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ msg: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret);

    // Поддерживаем оба формата: decoded.client и decoded.user с role='client'
    if (decoded && decoded.client) {
      req.client = decoded.client;
      req.user = { id: decoded.client.id, role: 'client', practitionerId: decoded.client.practitionerId || null };
      return next();
    }
    if (decoded && decoded.user && decoded.user.role === 'client') {
      req.user = decoded.user;
      return next();
    }

    return res.status(401).json({ msg: 'Токен не является клиентским' });
  } catch (err) {
    return res.status(401).json({ msg: 'Токен недействителен' });
  }
};
