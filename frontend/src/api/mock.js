// =============================================================================
// 前端 Mock 数据层
// 作用：本沙箱无 Java 运行时，后端无法启动。开启 VITE_USE_MOCK=true 时，
//       所有 API 调用返回本地模拟数据，使页面（积分流水 / 预警中心 / 推荐任务 /
//       数据看板）可立即演示。接上真实 Spring Boot 后端后，将该变量置为 false 即可。
// =============================================================================

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const delay = (data, ms = 200) => new Promise((resolve) => setTimeout(() => resolve(data), ms))

// ---------- 基础种子数据 ----------
const subjects = [
  { id: 1, name: '语文', classId: 10 },
  { id: 2, name: '数学', classId: 10 }
]

const students = [
  { id: 1, studentNo: 'S1001', name: '张三', classId: 10, totalCredits: 12 },
  { id: 2, studentNo: 'S1002', name: '李四', classId: 10, totalCredits: 8 },
  { id: 3, studentNo: 'S1003', name: '王五', classId: 10, totalCredits: 15 },
  { id: 4, studentNo: 'S1004', name: '赵六', classId: 10, totalCredits: 5 },
  { id: 5, studentNo: 'S1005', name: '钱七', classId: 10, totalCredits: 10 }
]

const tasks = [
  { id: 1, subjectId: 1, classId: 10, title: '《赤壁赋》背诵', type: 'BACKING', creditValue: 3, deadline: '2026-07-26 23:59', status: 'OPEN', subjectName: '语文' },
  { id: 2, subjectId: 2, classId: 10, title: '第三章习题', type: 'HOMEWORK', creditValue: 5, deadline: '2026-07-22 23:59', status: 'OPEN', subjectName: '数学' },
  { id: 3, subjectId: 1, classId: 10, title: '单元测试卷', type: 'EXAM', creditValue: 8, deadline: '2026-07-20 23:59', status: 'OPEN', subjectName: '语文' },
  { id: 4, subjectId: 2, classId: 10, title: '错题整理', type: 'HOMEWORK', creditValue: 4, deadline: '2026-07-30 23:59', status: 'OPEN', subjectName: '数学' }
]

// 完成记录：taskId -> [{studentId, status}]
const completion = {
  1: [ { studentId: 1, status: 'DONE_ONTIME' }, { studentId: 2, status: 'UNFINISHED' }, { studentId: 3, status: 'DONE_OVERDUE' }, { studentId: 4, status: 'UNFINISHED' }, { studentId: 5, status: 'DONE_ONTIME' } ],
  2: [ { studentId: 1, status: 'DONE_ONTIME' }, { studentId: 2, status: 'DONE_ONTIME' }, { studentId: 3, status: 'DONE_ONTIME' }, { studentId: 4, status: 'UNFINISHED' }, { studentId: 5, status: 'DONE_OVERDUE' } ],
  3: [ { studentId: 1, status: 'UNFINISHED' }, { studentId: 2, status: 'UNFINISHED' }, { studentId: 3, status: 'UNFINISHED' }, { studentId: 4, status: 'FAILED' }, { studentId: 5, status: 'UNFINISHED' } ],
  4: [ { studentId: 1, status: 'DONE_ONTIME' }, { studentId: 2, status: 'UNFINISHED' }, { studentId: 3, status: 'DONE_ONTIME' }, { studentId: 4, status: 'UNFINISHED' }, { studentId: 5, status: 'UNFINISHED' } ]
}

const flowTypeText = {
  HOMEWORK_DONE: '作业完成', BACKING_DONE: '背书完成', EXAM_DONE: '测验完成',
  OVERDUE_DEDUCT: '逾期扣分', REMEDY: '补修', MANUAL: '手动调整'
}
const statusText = { UNFINISHED: '未完成', DONE_ONTIME: '按时完成', DONE_OVERDUE: '逾期完成', FAILED: '未通过' }
const typeText = { HOMEWORK: '作业', BACKING: '背书', EXAM: '测验' }

import { calcCredit } from '@/utils/credit'

// 初始流水
let creditFlows = [
  { id: 1, userId: 1, userName: '张三', taskId: 1, taskTitle: '《赤壁赋》背诵', creditChange: 3, flowType: 'BACKING_DONE', createTime: '2026-07-18 09:12' },
  { id: 2, userId: 3, userName: '王五', taskId: 1, taskTitle: '《赤壁赋》背诵', creditChange: 1, flowType: 'OVERDUE_DEDUCT', createTime: '2026-07-17 21:40' },
  { id: 3, userId: 1, userName: '张三', taskId: 2, taskTitle: '第三章习题', creditChange: 5, flowType: 'HOMEWORK_DONE', createTime: '2026-07-16 14:05' },
  { id: 4, userId: 2, userName: '李四', taskId: 2, taskTitle: '第三章习题', creditChange: 5, flowType: 'HOMEWORK_DONE', createTime: '2026-07-16 15:20' },
  { id: 5, userId: 5, userName: '钱七', taskId: 2, taskTitle: '第三章习题', creditChange: 2, flowType: 'OVERDUE_DEDUCT', createTime: '2026-07-15 23:50' }
]
let flowSeq = 6

// 初始预警
let alerts = [
  { id: 1, studentId: 4, studentName: '赵六', classId: 10, className: '八（十）班', type: 'CONSECUTIVE_MISS', reason: '连续 3 个任务未完成（错题整理/单元测试卷/第三章习题）', status: 'PENDING', createTime: '2026-07-19 01:00' },
  { id: 2, studentId: 2, studentName: '李四', classId: 10, className: '八（十）班', type: 'OVERDUE_SOON', reason: '《单元测试卷》将于 2026-07-20 截止且尚未完成', status: 'PENDING', createTime: '2026-07-19 01:00' }
]
let alertSeq = 3

// ---------- 工具：计算完成率 ----------
function buildSubjectRate() {
  return subjects.map((s) => {
    const recs = Object.entries(completion).flatMap(([tid, list]) =>
      list.filter((r) => tasks.find((t) => t.id === Number(tid))?.subjectId === s.id)
        .map((r) => ({ ...r, taskId: Number(tid) }))
    )
    const total = recs.length
    const done = recs.filter((r) => r.status === 'DONE_ONTIME' || r.status === 'DONE_OVERDUE').length
    return {
      subjectName: s.name,
      total,
      done,
      completionRate: total ? Math.round((done / total) * 100) : 0
    }
  })
}

function buildStatusDistribution() {
  const all = Object.values(completion).flat()
  return {
    unfinished: all.filter((r) => r.status === 'UNFINISHED').length,
    ontime: all.filter((r) => r.status === 'DONE_ONTIME').length,
    overdue: all.filter((r) => r.status === 'DONE_OVERDUE').length,
    failed: all.filter((r) => r.status === 'FAILED').length
  }
}

// 学生学分趋势（按流水时间累计）
function buildCreditTrend(studentId) {
  const list = creditFlows
    .filter((f) => f.userId === studentId)
    .sort((a, b) => a.createTime.localeCompare(b.createTime))
  let acc = 0
  const base = students.find((s) => s.id === studentId)?.totalCredits || 0
  // 以最后一条为起点，向前倒推展示（简化：以 seed 学分作起点）
  const series = []
  let running = base - list.reduce((sum, f) => sum + f.creditChange, 0)
  list.forEach((f) => {
    running += f.creditChange
    series.push({ date: f.createTime.slice(0, 10), credits: running })
  })
  if (series.length === 0) series.push({ date: '2026-07-15', credits: base })
  return series
}

// ---------- 公共 Mock API ----------
// Mock 用户库（与后端 DataInitializer 一致）
const mockUsers = [
  { id: 1, username: 'teacher01', password: '123456', realName: '王老师', role: 'TEACHER', classId: 10 },
  { id: 2, username: 'rep01',    password: '123456', realName: '科代表小李', role: 'REP',     classId: 10 },
  { id: 3, username: 'admin',    password: '123456', realName: '管理员',   role: 'ADMIN',   classId: null },
  // 学生账号：id 对应 student 表中学生记录 id（张三=1），用于「学生端」按登录身份展示
  { id: 1, username: 'student01', password: '123456', realName: '张三', role: 'STUDENT', classId: 10, studentId: 1 }
]
// 当前已登录的 Mock 用户（getMe 用）
let currentUser = null

export const mockApi = {
  get useMock() { return useMock },

  // 登录（Mock 模式：本地验证，返回假 JWT）
  login(payload) {
    const u = mockUsers.find((u) => u.username === payload.username && u.password === payload.password)
    if (!u) {
      return Promise.reject(new Error('用户名或密码错误'))
    }
    currentUser = u
    // 假 token（仅用于前端展示，不参与真实鉴权）
    const token = 'mock-jwt-token-' + Date.now()
    return delay({
      code: 0,
      data: {
        token,
        user: { id: u.id, username: u.username, realName: u.realName, role: u.role, classId: u.classId, studentId: u.studentId ?? null }
      },
      msg: 'ok'
    })
  },

  // 获取当前用户
  getMe() {
    if (!currentUser) return delay(null)
    return delay({
      code: 0,
      data: { id: currentUser.id, username: currentUser.username, realName: currentUser.realName, role: currentUser.role, classId: currentUser.classId, studentId: currentUser.studentId ?? null },
      msg: 'ok'
    })
  },

  // 学生
  listStudents() {
    return delay(students.map((s) => ({ ...s, className: '八（十）班' })))
  },

  // 任务
  listTasks() { return delay(tasks) },
  createTask(payload) {
    const id = Math.max(0, ...tasks.map((t) => t.id)) + 1
    const t = { id, classId: 10, status: 'OPEN', subjectName: subjects.find((s) => s.id === payload.subjectId)?.name, ...payload }
    tasks.push(t)
    return delay(t)
  },
  saveAsTemplate(payload) {
    const id = Math.max(0, ...taskTemplates.map((t) => t.id)) + 1
    taskTemplates.push({ id, name: payload.title + '·模板', subjectId: payload.subjectId, type: payload.type, creditValue: payload.creditValue, description: payload.description, creatorId: 1 })
    return delay({ id })
  },
  createFromTemplate(templateId) {
    const tpl = taskTemplates.find((t) => t.id === templateId)
    if (!tpl) return delay(null)
    const id = Math.max(0, ...tasks.map((t) => t.id)) + 1
    const t = { id, classId: 10, status: 'OPEN', subjectId: tpl.subjectId, type: tpl.type, creditValue: tpl.creditValue, description: tpl.description, title: tpl.name, subjectName: subjects.find((s) => s.id === tpl.subjectId)?.name }
    tasks.push(t)
    return delay(t)
  },
  listTemplates() { return delay(taskTemplates) },

  // 完成登记
  registerCompletion(payload) {
    // payload: { taskId, studentIds, status }
    const tid = payload.taskId
    if (!completion[tid]) completion[tid] = []
    let gained = 0
    payload.studentIds.forEach((sid) => {
      const idx = completion[tid].findIndex((r) => r.studentId === sid)
      const prev = idx >= 0 ? completion[tid][idx].status : null
      if (idx >= 0) completion[tid][idx].status = payload.status
      else completion[tid].push({ studentId: sid, status: payload.status })
      const t = tasks.find((x) => x.id === tid)
      const isDone = payload.status === 'DONE_ONTIME' || payload.status === 'DONE_OVERDUE'
      if (isDone) {
        const { credit: change, flowType: fType } = calcCredit(t.creditValue, t.type, payload.status)
        const st = students.find((s) => s.id === sid)
        st.totalCredits += change
        gained += change
        creditFlows.push({ id: flowSeq++, userId: sid, userName: st.name, taskId: tid, taskTitle: t.title, creditChange: change, flowType: fType, createTime: new Date().toISOString().slice(0, 16).replace('T', ' ') })
      }
    })
    return delay({ affected: payload.studentIds.length, gained })
  },

  // 积分流水
  listCreditFlow(params = {}) {
    let list = [...creditFlows].sort((a, b) => b.createTime.localeCompare(a.createTime))
    if (params.userId) list = list.filter((f) => f.userId === Number(params.userId))
    if (params.flowType) list = list.filter((f) => f.flowType === params.flowType)
    return delay(list)
  },

  // 预警
  listAlerts() { return delay(alerts.map((a) => ({ ...a, typeText: a.type === 'CONSECUTIVE_MISS' ? '连续未完成' : '临近截止未完成' }))) },
  resolveAlert(id) {
    const a = alerts.find((x) => x.id === id)
    if (a) a.status = 'RESOLVED'
    return delay({ ok: true })
  },
  // 手动触发扫描（演示用）
  scanAlerts() {
    alerts.push({ id: alertSeq++, studentId: 2, studentName: '李四', classId: 10, className: '八（十）班', type: 'CONSECUTIVE_MISS', reason: '连续 3 个任务未完成', status: 'PENDING', createTime: new Date().toISOString().slice(0, 16).replace('T', ' ') })
    return delay({ ok: true, count: 1 })
  },

  // 推荐
  recommend(params = {}) {
    // 取该生未完成/未通过的同班任务
    const sid = params.studentId || 4
    const recs = []
    Object.entries(completion).forEach(([tid, list]) => {
      const r = list.find((x) => x.studentId === sid && (x.status === 'UNFINISHED' || x.status === 'FAILED'))
      if (r) {
        const t = tasks.find((x) => x.id === Number(tid))
        recs.push({ taskId: t.id, title: t.title, subjectName: t.subjectName, type: t.type, typeText: typeText[t.type], creditValue: t.creditValue, reason: r.status === 'FAILED' ? '上次未通过，建议补修' : '尚未完成，临近截止' })
      }
    })
    return delay(recs)
  },

  // 看板
  dashboardOverview() {
    return delay({
      subjectCompletionRate: buildSubjectRate(),
      statusDistribution: buildStatusDistribution(),
      summary: { studentCount: students.length, taskCount: tasks.length, avgCredits: Math.round(students.reduce((s, x) => s + x.totalCredits, 0) / students.length) }
    })
  },
  listOperateLogs(params = {}) {
    let list = [...operateLogs].sort((a, b) => b.createTime.localeCompare(a.createTime))
    if (params.operateType) list = list.filter((l) => l.operateType === params.operateType)
    if (params.operatorName) list = list.filter((l) => l.operatorName.includes(params.operatorName))
    if (params.startTime) list = list.filter((l) => l.createTime >= params.startTime)
    if (params.endTime) list = list.filter((l) => l.createTime <= params.endTime)
    return delay({ records: list, total: list.length })
  },
  creditTrend(studentId) { return delay(buildCreditTrend(studentId || 1)) },
  drillDownSubject(subjectId) {
    const ts = tasks.filter((t) => t.subjectId === subjectId)
    const rows = ts.map((t) => {
      const recs = (completion[t.id] || []).map((r) => ({ studentName: students.find((s) => s.id === r.studentId)?.name, status: statusText[r.status] }))
      return { taskId: t.id, title: t.title, records: recs }
    })
    return delay(rows)
  },
  drillDownStatus(status) {
    const rows = []
    Object.entries(completion).forEach(([tid, list]) => {
      list.filter((r) => r.status === status).forEach((r) => {
        const t = tasks.find((x) => x.id === Number(tid))
        rows.push({ taskTitle: t.title, studentName: students.find((s) => s.id === r.studentId)?.name, status: statusText[r.status] })
      })
    })
    return delay(rows)
  }
}

const taskTemplates = [
  { id: 1, name: '《赤壁赋》背诵·模板', subjectId: 1, type: 'BACKING', creditValue: 3, description: '默写并背诵全文', creatorId: 1 },
  { id: 2, name: '第三章习题·模板', subjectId: 2, type: 'HOMEWORK', creditValue: 5, description: '完成课后习题 1-10', creatorId: 1 }
]

// 操作日志（指令6：审计）
let operateLogs = [
  { id: 1, operatorName: '科代表小李', operateType: 'UPDATE', tableName: 'completion_record', recordId: 1, beforeSnapshot: '{"status":"UNFINISHED","credit_change":0}', afterSnapshot: '{"status":"DONE_ONTIME","credit_change":3}', createTime: '2026-07-18 09:12:30' },
  { id: 2, operatorName: '科代表小李', operateType: 'UPDATE', tableName: 'completion_record', recordId: 5, beforeSnapshot: '{"status":"UNFINISHED","credit_change":0}', afterSnapshot: '{"status":"DONE_OVERDUE","credit_change":1}', createTime: '2026-07-17 21:40:10' },
  { id: 3, operatorName: '王老师', operateType: 'INSERT', tableName: 'task', recordId: 3, beforeSnapshot: null, afterSnapshot: '{"title":"单元测试卷","credit_value":8}', createTime: '2026-07-15 10:05:00' }
]

export { useMock, flowTypeText, statusText, typeText }
