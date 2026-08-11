const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fmtDate, paginate } = require('../util');
const { requireRole } = require('../middleware/rbac');

// 操作日志查询（管理员/主理人/小组长可看）：支持时间范围筛选 + 分页
router.get('/', requireRole('ADMIN', 'TEACHER', 'REP'), async (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const params = [];
  const countParams = [];
  let where = 'WHERE 1=1';
  if (req.query.operateType) { where += ' AND operate_type=?'; params.push(req.query.operateType); countParams.push(req.query.operateType); }
  if (req.query.operatorName) { where += ' AND operator_name LIKE ?'; params.push('%' + req.query.operatorName + '%'); countParams.push('%' + req.query.operatorName + '%'); }
  if (req.query.startTime) { where += ' AND create_time >= ?'; params.push(req.query.startTime); countParams.push(req.query.startTime); }
  if (req.query.endTime) { where += ' AND create_time <= ?'; params.push(req.query.endTime); countParams.push(req.query.endTime); }
  const total = (await db.prepare(`SELECT COUNT(*) AS c FROM operate_log ${where}`).get(...countParams)).c;
  const rows = await db.prepare(`SELECT * FROM operate_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
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
  ok(res, { records, total, page, pageSize, hasMore: offset + rows.length < total });
});

module.exports = router;
