import { describe, it, expect, beforeEach } from 'vitest'
import { mockApi } from '@/api/mock'

describe('mockApi —— 阶段二核心数据逻辑', () => {
  beforeEach(() => {
    // 每次用例前重置状态，保证隔离
    mockApi.resetState && mockApi.resetState()
  })

  it('registerCompletion：按时完成 -> 学生 totalCredits 增加、生成流水', async () => {
    const before = (await mockApi.listStudents()).find((s) => s.id === 1)
    const start = before.totalCredits
    await mockApi.registerCompletion({ taskId: 4, studentIds: [1], status: 'DONE_ONTIME' })
    const after = (await mockApi.listStudents()).find((s) => s.id === 1)
    // 任务4（错题整理）creditValue=4，按时完成应 +4
    expect(after.totalCredits).toBe(start + 4)
    const flows = await mockApi.listCreditFlow({ userId: 1 })
    expect(flows.some((f) => f.taskId === 4 && f.creditChange === 4)).toBe(true)
  })

  it('registerCompletion：逾期完成 -> 得分向下取整一半', async () => {
    await mockApi.registerCompletion({ taskId: 4, studentIds: [2], status: 'DONE_OVERDUE' })
    // 任务4 creditValue=4 -> 逾期实际得 2
    const flows = await mockApi.listCreditFlow({ userId: 2 })
    expect(flows.some((f) => f.taskId === 4 && f.creditChange === 2 && f.flowType === 'OVERDUE_DEDUCT')).toBe(true)
  })

  it('recommend：返回该生未完成/未通过的补修任务', async () => {
    const recs = await mockApi.recommend({ studentId: 4 })
    // 赵六(4) 在任务2/3/4 有未完成或 FAILED
    expect(Array.isArray(recs)).toBe(true)
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0]).toHaveProperty('title')
    expect(recs[0]).toHaveProperty('reason')
  })

  it('dashboardOverview：返回各科目完成率与状态分布', async () => {
    const d = await mockApi.dashboardOverview()
    expect(d.subjectCompletionRate.length).toBe(2)
    expect(d.statusDistribution).toHaveProperty('ontime')
    expect(d.summary).toHaveProperty('avgCredits')
    // 完成率应在 0-100
    d.subjectCompletionRate.forEach((s) => {
      expect(s.completionRate).toBeGreaterThanOrEqual(0)
      expect(s.completionRate).toBeLessThanOrEqual(100)
    })
  })

  it('drillDownStatus：按状态过滤出对应学生明细', async () => {
    const rows = await mockApi.drillDownStatus('UNFINISHED')
    expect(Array.isArray(rows)).toBe(true)
    rows.forEach((r) => expect(r.status).toBe('未完成'))
  })

  it('listOperateLogs：支持操作人/类型筛选', async () => {
    const all = await mockApi.listOperateLogs({})
    expect(all.total).toBeGreaterThan(0)
    const filtered = await mockApi.listOperateLogs({ operateType: 'INSERT' })
    filtered.records.forEach((r) => expect(r.operateType).toBe('INSERT'))
  })

  it('drillDownSubject：返回该科目下各任务的完成学生明细', async () => {
    const rows = await mockApi.drillDownSubject(1)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toHaveProperty('records')
  })

  it('creditTrend：返回按时间累计的学分序列', async () => {
    const series = await mockApi.creditTrend(1)
    expect(Array.isArray(series)).toBe(true)
    expect(series.length).toBeGreaterThan(0)
    expect(series[0]).toHaveProperty('date')
    expect(series[0]).toHaveProperty('credits')
  })
})
