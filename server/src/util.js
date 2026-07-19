// 统一响应封装
function ok(res, data, message = 'success') {
  return res.json({ code: 0, message, data });
}
function fail(res, code, message) {
  return res.status(code).json({ code, message });
}
// 将 'YYYY-MM-DD HH:MM:SS' 格式化为前端展示用的 'YYYY-MM-DD HH:mm'
function fmtDate(s) {
  if (!s) return '';
  return String(s).slice(0, 16);
}
module.exports = { ok, fail, fmtDate };
