const jwt = require('jsonwebtoken');

const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

const generateAccessToken = (userId, role) => {
  return generateToken(
    { userId, role },
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN || '15m'
  );
};

const generateRefreshToken = (userId) => {
  return generateToken(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  );
};

module.exports = {
  generateToken,
  verifyToken,
  generateAccessToken,
  generateRefreshToken
};