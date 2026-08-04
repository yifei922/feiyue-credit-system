// 认证工具：JWT 签发/校验 + 密码哈希（bcryptjs 纯 JS，免原生编译）
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-prod';
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '12h';

function hashPassword(p) {
  return bcrypt.hashSync(p, 10);
}
function verifyPassword(p, hash) {
  return bcrypt.compareSync(p, hash);
}
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { JWT_SECRET, hashPassword, verifyPassword, signToken, verifyToken };
