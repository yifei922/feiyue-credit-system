// 操作日志写入（指令6：审计）
const { db } = require('../db');

function recordLog(operator, operateType, tableName, recordId, before, after) {
  if (!operator) return;
  db.prepare(
    `INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot)
     VALUES(?,?,?,?,?,?,?)`
  ).run(
    operator.id,
    operator.name,
    operateType,
    tableName,
    recordId,
    JSON.stringify(before ?? {}),
    JSON.stringify(after ?? {})
  );
}

module.exports = { recordLog };
