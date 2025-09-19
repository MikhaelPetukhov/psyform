const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return next();
  }
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // Skip auth if JWT_SECRET not configured
    }
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.user) req.user = decoded.user;
    if (decoded.client) req.client = decoded.client;
  } catch (err) {
    // ignore invalid token in optional mode
  }
  next();
};
