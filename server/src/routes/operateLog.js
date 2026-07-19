const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fmtDate } = require('../util');
const { requireRole } = require('../middleware/rbac');

// 操作日志查询（管理员/老师/课代表可看）
router.get('/', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const params = [];
  let sql = 'SELECT * FROM operate_log WHERE 1=1';
  if (req.query.operateType) { sql += ' AND operate_type=?'; params.push(req.query.operateType); }
  if (req.query.operatorName) { sql += ' AND operator_name LIKE ?'; params.push('%' + req.query.operatorName + '%'); }
  if (req.query.startTime) { sql += ' AND create_time >= ?'; params.push(req.query.startTime); }
  if (req.query.endTime) { sql += ' AND create_time <= ?'; params.push(req.query.endTime); }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  const records = rows.map(r => ({
    id: r.id,
    operatorName: r.operator_name,
    operateType: r.operate_type,
    tableName: r.table_name,
    recordId: r.record_id,
    beforeSnapshot: r.before_snapshot,
    afterSnapshot: r.after_snapshot,
    createTime: fmtDate(r.create_time)
  }));
  ok(res, { records, total: records.length });
});

module.exports = router;
