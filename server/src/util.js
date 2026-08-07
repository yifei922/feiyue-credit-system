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
// 统一的列表分页参数解析：支持 page / pageSize(或 limit)，默认第 1 页、每页 20、上限 200
function paginate(query = {}) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize) || parseInt(query.limit) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit: pageSize, offset };
}
// 分页元信息以响应头返回（X-Total-Count / X-Page / X-Page-Size / X-Has-More），
// 列表主体仍返回「数组」，保证网页端（直接遍历数组）与小程序端（读头做加载更多）都兼容。
function setPageHeaders(res, { total = 0, page = 1, pageSize = 20, hasMore = false } = {}) {
  res.set({
    'X-Total-Count': String(total),
    'X-Page': String(page),
    'X-Page-Size': String(pageSize),
    'X-Has-More': hasMore ? 'true' : 'false',
  });
}
module.exports = { ok, fail, fmtDate, paginate, setPageHeaders };
