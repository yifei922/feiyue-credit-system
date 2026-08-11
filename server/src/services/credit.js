// 积分计算规则（与前端 src/utils/credit.js 完全一致）
// DONE_ONTIME 满分；DONE_OVERDUE 半分(向下取整)；UNFINISHED/FAILED 0
// label 字典已抽到 constants.js 统一维护，本文件保持向后兼容 re-export。
const { STATUS_LABEL, FLOW_TYPE_LABEL, TYPE_LABEL, ALERT_TYPE_LABEL } = require('../constants');

function calcCredit(creditValue, type, status) {
  const v = Number(creditValue) || 0;
  if (status === 'DONE_ONTIME') {
    return { credit: v, flowType: type === 'BACKING' ? 'BACKING_DONE' : 'HOMEWORK_DONE' };
  }
  if (status === 'DONE_OVERDUE') {
    return { credit: Math.floor(v * 0.5), flowType: 'OVERDUE_DEDUCT' };
  }
  return { credit: 0, flowType: 'MANUAL' };
}

module.exports = { calcCredit, STATUS_LABEL, FLOW_TYPE_LABEL, TYPE_LABEL, ALERT_TYPE_LABEL };