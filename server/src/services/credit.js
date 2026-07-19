// 学分计算规则（与前端 src/utils/credit.js 完全一致）
// DONE_ONTIME 满分；DONE_OVERDUE 半分(向下取整)；UNFINISHED/FAILED 0
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

const STATUS_LABEL = {
  DONE_ONTIME: '按时完成',
  DONE_OVERDUE: '逾期完成',
  UNFINISHED: '未完成',
  FAILED: '未通过'
};
const FLOW_TYPE_LABEL = {
  HOMEWORK_DONE: '作业完成',
  BACKING_DONE: '背书完成',
  EXAM_DONE: '测验完成',
  OVERDUE_DEDUCT: '逾期扣分',
  REMEDY: '补修',
  MANUAL: '手动调整'
};
const TYPE_LABEL = { HOMEWORK: '作业', BACKING: '背书', EXAM: '测验' };
const ALERT_TYPE_LABEL = {
  CONSECUTIVE_MISS: '连续未完成',
  OVERDUE_SOON: '临近截止未完成',
  LOW_CREDIT: '学分偏低'
};

module.exports = { calcCredit, STATUS_LABEL, FLOW_TYPE_LABEL, TYPE_LABEL, ALERT_TYPE_LABEL };
