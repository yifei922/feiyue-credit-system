import { describe, it, expect } from 'vitest'
import { calcCredit, statusLabel, flowTypeLabel, typeLabel } from '@/utils/credit'

describe('calcCredit —— 学分计算核心逻辑', () => {
  it('DONE_ONTIME 得满分，BACKING 映射 BACKING_DONE', () => {
    const r = calcCredit(3, 'BACKING', 'DONE_ONTIME')
    expect(r.credit).toBe(3)
    expect(r.flowType).toBe('BACKING_DONE')
  })

  it('DONE_ONTIME HOMEWORK/EXAM 映射 HOMEWORK_DONE', () => {
    expect(calcCredit(5, 'HOMEWORK', 'DONE_ONTIME').flowType).toBe('HOMEWORK_DONE')
    expect(calcCredit(8, 'EXAM', 'DONE_ONTIME').flowType).toBe('HOMEWORK_DONE')
  })

  it('DONE_OVERDUE 取满分向下取整的一半，记为 OVERDUE_DEDUCT', () => {
    expect(calcCredit(5, 'HOMEWORK', 'DONE_OVERDUE')).toEqual({ credit: 2, flowType: 'OVERDUE_DEDUCT' })
    expect(calcCredit(3, 'BACKING', 'DONE_OVERDUE')).toEqual({ credit: 1, flowType: 'OVERDUE_DEDUCT' })
  })

  it('UNFINISHED / FAILED 不计分', () => {
    expect(calcCredit(5, 'HOMEWORK', 'UNFINISHED')).toEqual({ credit: 0, flowType: 'MANUAL' })
    expect(calcCredit(5, 'HOMEWORK', 'FAILED')).toEqual({ credit: 0, flowType: 'MANUAL' })
  })

  it('向下取整边界（偶数/奇数学分）', () => {
    expect(calcCredit(4, 'HOMEWORK', 'DONE_OVERDUE').credit).toBe(2)
    expect(calcCredit(7, 'HOMEWORK', 'DONE_OVERDUE').credit).toBe(3)
  })
})

describe('字典映射', () => {
  it('statusLabel', () => {
    expect(statusLabel('DONE_ONTIME')).toBe('按时完成')
    expect(statusLabel('UNFINISHED')).toBe('未完成')
  })
  it('flowTypeLabel', () => {
    expect(flowTypeLabel('OVERDUE_DEDUCT')).toBe('逾期扣分')
    expect(flowTypeLabel('BACKING_DONE')).toBe('背书完成')
  })
  it('typeLabel', () => {
    expect(typeLabel('HOMEWORK')).toBe('作业')
    expect(typeLabel('EXAM')).toBe('测验')
  })
})
