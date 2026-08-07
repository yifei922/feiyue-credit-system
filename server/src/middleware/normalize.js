// 入参命名归一中间件：将常见 snake_case 字段别名映射为后端统一使用的 camelCase，
// 作为「契约一致性」的防御层——即使小程序端偶发用旧的下划线命名，后端也能正确读取，
// 从源头杜绝 B1–B4 这类「字段名不一致导致功能失效」的回归。
// 注意：仅当 camelCase 字段缺失时才用 snake_case 别名兜底，绝不覆盖已存在的值。
const ALIASES = {
  student_id: 'studentId',
  task_id: 'taskId',
  subject_id: 'subjectId',
  user_id: 'userId',
  class_id: 'classId',
  record_id: 'recordId',
  student_ids: 'studentIds',
  subject_ids: 'subjectIds',
  resource_id: 'resourceId',
  credit_value: 'creditValue',
  student_no: 'studentNo',
  operator_id: 'operatorId',
  change_amount: 'changeAmount',
  flow_type: 'flowType',
  total_credits: 'totalCredits',
  operate_type: 'operateType',
  operator_name: 'operatorName',
  table_name: 'tableName',
  create_time: 'createTime',
};

function normalizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    for (const [snake, camel] of Object.entries(ALIASES)) {
      if (Object.prototype.hasOwnProperty.call(req.body, snake) && !Object.prototype.hasOwnProperty.call(req.body, camel)) {
        req.body[camel] = req.body[snake];
      }
    }
  }
  next();
}

module.exports = { normalizeBody, ALIASES };
