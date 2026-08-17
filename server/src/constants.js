// 集中常量与工具：避免多处复制
const crypto = require('crypto');

const ROLE_LABEL = { ADMIN: '管理员', TEACHER: '教师', REP: '课代表', STUDENT: '学生' };

const STATUS_LABEL = {
  DONE_ONTIME: '按时完成',
  DONE_OVERDUE: '逾期完成',
  UNFINISHED: '未完成',
  FAILED: '未通过'
};

const FLOW_TYPE_LABEL = {
  HOMEWORK_DONE: '打卡完成',
  BACKING_DONE: '练习完成',
  EXAM_DONE: '挑战完成',
  OVERDUE_DEDUCT: '逾期扣分',
  REMEDY: '补修',
  MANUAL: '手动调整'
};

const TYPE_LABEL = { HOMEWORK: '打卡任务', BACKING: '练习', EXAM: '挑战' };

const ALERT_TYPE_LABEL = {
  CONSECUTIVE_MISS: '连续未完成',
  OVERDUE_SOON: '临近截止未完成',
  LOW_CREDIT: '积分偏低',
  REMIND: '任务提醒'
};

/**
 * 生成随机临时密码（大小写+数字，去除易混淆字符 I/O/0/1/l）。
 * 默认 10 位，前端一次性展示给管理员；用户首次登录后由 must_change_pwd 强制改密。
 * 历史：users.js / students.js 各自一份实现，现合并到此处。
 */
function genTempPwd(len = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

module.exports = {
  ROLE_LABEL, STATUS_LABEL, FLOW_TYPE_LABEL, TYPE_LABEL, ALERT_TYPE_LABEL,
  genTempPwd
};