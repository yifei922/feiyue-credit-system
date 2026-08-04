// RBAC：三角色(管理员/课代表/学生) + 范围隔离
// ADMIN 老师：全部数据、全部操作
// REP  课代表：仅可管理其负责的科目(由 subject_rep 关联决定)下的任务与数据
// STUDENT 学生：仅可查看本人数据
const { db } = require('../db');
const { fail } = require('../util');

const ROLE_LABEL = { ADMIN: '管理员', TEACHER: '老师', REP: '课代表', STUDENT: '学生' };

// 角色检查中间件工厂
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, '未登录');
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, `需要 ${roles.map(r => ROLE_LABEL[r] || r).join('/')} 权限`);
    }
    next();
  };
}

// 获取某用户可管理的科目 id 列表（ADMIN=全部，REP=关联科目，STUDENT=空）
function getManagedSubjectIds(user) {
  if (user.role === 'ADMIN') {
    return db.prepare('SELECT id FROM subject').all().map(r => r.id);
  }
  if (user.role === 'REP') {
    return db.prepare('SELECT subject_id FROM subject_rep WHERE user_id=?').all(user.id).map(r => r.subject_id);
  }
  return [];
}

// 校验用户是否可管理指定科目（用于任务创建/修改的越权拦截）
function canManageSubject(user, subjectId) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'REP') {
    const ids = getManagedSubjectIds(user);
    return ids.includes(Number(subjectId));
  }
  return false;
}

module.exports = { requireRole, getManagedSubjectIds, canManageSubject, ROLE_LABEL };
