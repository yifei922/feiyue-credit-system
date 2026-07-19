// 学分计算与字典映射（纯函数，便于单元测试与前后端复用同一规则）
// 规则（与 Spring Boot CompletionServiceImpl 一致）：
//   DONE_ONTIME ：按时完成，得满分 creditValue；流水类型按任务类型映射
//                 （BACKING -> BACKING_DONE，其余 HOMEWORK/EXAM -> HOMEWORK_DONE）
//   DONE_OVERDUE：逾期完成，实际得分 = floor(creditValue * 0.5)（向下取整）
//   UNFINISHED / FAILED：不计分
export function calcCredit(creditValue, type, status) {
  if (status === 'DONE_ONTIME') {
    return {
      credit: creditValue,
      flowType: type === 'BACKING' ? 'BACKING_DONE' : 'HOMEWORK_DONE'
    }
  }
  if (status === 'DONE_OVERDUE') {
    return {
      credit: Math.floor(creditValue * 0.5),
      flowType: 'OVERDUE_DEDUCT'
    }
  }
  return { credit: 0, flowType: 'MANUAL' }
}

export function statusLabel(status) {
  return (
    { UNFINISHED: '未完成', DONE_ONTIME: '按时完成', DONE_OVERDUE: '逾期完成', FAILED: '未通过' }[status] || status
  )
}

export function flowTypeLabel(flowType) {
  return (
    {
      HOMEWORK_DONE: '作业完成',
      BACKING_DONE: '背书完成',
      EXAM_DONE: '测验完成',
      OVERDUE_DEDUCT: '逾期扣分',
      REMEDY: '补修',
      MANUAL: '手动调整'
    }[flowType] || flowType
  )
}

export function typeLabel(type) {
  return ({ HOMEWORK: '作业', BACKING: '背书', EXAM: '测验' }[type] || type)
}
