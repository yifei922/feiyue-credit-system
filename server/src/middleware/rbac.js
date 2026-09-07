// RBAC：角色 + 范围隔离 + 角色继承（任务 5：课代表=学生身份，双身份）
// 角色继承链（高 → 低）：ADMIN ⊃ TEACHER ⊃ REP ⊃ STUDENT
//   ADMIN    ：全部数据、全部操作（含变更角色等高风险操作，受额外 username 保护）
//   TEACHER  ：管理班级成员、布置任务、登记完成情况；可建 REP/STUDENT
//   REP      ：管理所负责学科的任务/数据；同时具备 STUDENT 全部能力（提交作业、查看积分）
//   STUDENT  ：仅可查看本人数据、提交作业
const { db } = require('../db');
const { fail } = require('../util');
const { ROLE_LABEL } = require('../constants');

// 角色等级：数字越大权限越高
const ROLE_LEVEL = { STUDENT: 1, REP: 2, TEACHER: 3, ADMIN: 4 };

/**
 * 判断 userRole 是否满足 allowedRoles 之一（含角色继承）
 * 例：allowedRoles=['STUDENT'] 时，REP/TEACHER/ADMIN 均可通过（REP=学生兼课代表，TEACHER/ADMIN 天然包含）
 */
function hasRole(userRole, allowedRoles) {
  if (!userRole || !ROLE_LEVEL[userRole]) return false;
  const userLevel = ROLE_LEVEL[userRole];
  return allowedRoles.some((r) => {
    const required = ROLE_LEVEL[r];
    if (!required) return false;
    return userLevel >= required;
  });
}

// 角色检查中间件工厂（支持角色继承）
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return fail(res, 401, '未登录');
    if (!hasRole(req.user.role, roles)) {
      return fail(res, 403, `需要 ${roles.map(r => ROLE_LABEL[r] || r).join('/')} 权限`);
    }
    next();
  };
}

// 获取某用户可管理的兴趣分类 id 列表（ADMIN=全部，TEACHER=全部，REP=关联学科，STUDENT=空）
async function getManagedSubjectIds(user) {
  if (user.role === 'ADMIN' || user.role === 'TEACHER') {
    return (await db.prepare('SELECT id FROM subject').all()).map(r => r.id);
  }
  if (user.role === 'REP') {
    return (await db.prepare('SELECT subject_id FROM subject_rep WHERE user_id=?').all(user.id)).map(r => r.subject_id);
  }
  return [];
}

// 校验用户是否可管理指定学科
async function canManageSubject(user, subjectId) {
  if (user.role === 'ADMIN' || user.role === 'TEACHER') return true;
  if (user.role === 'REP') {
    const ids = await getManagedSubjectIds(user);
    return ids.includes(Number(subjectId));
  }
  return false;
}

/**
 * 读取用户在 DB 中的最新角色与权限信息（任务 5：实时同步身份变更）
 * 用于登录成功后或前端主动刷新时，避免 token 缓存导致身份更新延迟
 */
async function fetchEffectiveUser(userId) {
  const row = await db.prepare(
    `SELECT u.id, u.username, u.name, u.role, u.student_id AS studentId, u.class_id AS classId, u.avatar,
            u.must_change_pwd AS mustChangePwd,
            (SELECT GROUP_CONCAT(sr.subject_id) FROM subject_rep sr WHERE sr.user_id=u.id) AS subjectIds
     FROM sys_user u WHERE u.id=?`
  ).get(userId);
  if (!row) return null;
  const subjectIds = row.subjectIds ? String(row.subjectIds).split(',').map(Number).filter(Boolean) : [];
  // 任务 5：课代表也是学生身份（双身份）。REP 用户自动获得 STUDENT 权限
  // 注意：这里仅补充前端展示信息，真正的权限校验仍由 requireRole 通过角色继承处理
  return {
    id: row.id, username: row.username, name: row.name, role: row.role,
    studentId: row.studentId, classId: row.classId, avatar: row.avatar,
    mustChangePwd: !!row.mustChangePwd,
    roleLabel: ROLE_LABEL[row.role] || row.role,
    subjectIds,
    // 双身份：REP 角色自动继承 STUDENT 能力
    effectiveRoles: row.role === 'REP' ? ['REP', 'STUDENT'] : [row.role],
  };
}

module.exports = { requireRole, getManagedSubjectIds, canManageSubject, fetchEffectiveUser, hasRole, ROLE_LEVEL, ROLE_LABEL };
