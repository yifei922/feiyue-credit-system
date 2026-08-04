import sharp from 'sharp'

const BASE = 'http://localhost:3001'
const log = (...a) => console.log(...a)

function makeForm(fileBuf, filename, contentType, taskId) {
  const fd = new FormData()
  fd.append('file', new Blob([fileBuf], { type: contentType }), filename)
  if (taskId) fd.append('taskId', String(taskId))
  return fd
}

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const j = await r.json()
  if (!j.data?.token) { log('LOGIN FAIL', username, JSON.stringify(j)); process.exit(1) }
  return j.data.token
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// 1) 学生登录修复
const stuToken = await login('student01', '123456')
log('✅ student01 登录成功')

// 2) 王老师 -> 杨老师
const teaToken = await login('teacher01', '123456')
const tea = await (async () => {
  const r = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${teaToken}` } })
  return (await r.json()).data
})()
log(tea.realName === '杨老师' ? '✅ teacher01 姓名已改为 杨老师' : `❌ teacher01 姓名仍是 ${tea.realName}`)

// 3) 生成测试大图并上传（验证压缩）
const big = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 30, b: 30 } } })
  .jpeg({ quality: 100 }).toBuffer()
log(`原始图片体积: ${(big.length / 1024).toFixed(1)} KB`)

const fd = makeForm(big, 'homework.jpg', 'image/jpeg', 1)
const upRes = await fetch(`${BASE}/api/uploads`, {
  method: 'POST', headers: { Authorization: `Bearer ${stuToken}` }, body: fd
})
const up = await upRes.json()
log('上传返回:', JSON.stringify(up.data))
const d = up.data
if (d.sizeCompressed < d.sizeOriginal) log(`✅ 图片已自动压缩: ${(d.sizeOriginal/1024).toFixed(1)}KB -> ${(d.sizeCompressed/1024).toFixed(1)}KB (${Math.round((1-d.sizeCompressed/d.sizeOriginal)*100)}%)`)
else log('❌ 图片未压缩')

// 4) 非图片原样存储（txt）
const txt = Buffer.from('hello attachment test')
const fd2 = makeForm(txt, 'note.txt', 'text/plain', 1)
const up2 = await (await fetch(`${BASE}/api/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${stuToken}` }, body: fd2 })).json()
log(up2.data?.sizeCompressed === up2.data?.sizeOriginal ? '✅ 非图片文件原样存储（体积不变）' : '❌ 非图片被错误处理')

// 5) 学生提交完成作业（必须带附件，已上传）
const reg = await fetch(`${BASE}/api/completion/register`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stuToken}` },
  body: JSON.stringify({ taskId: 1, status: 'DONE_ONTIME' })
}).then(r => r.json())
log(reg.data?.affected === 1 ? '✅ 学生提交完成作业成功' : `❌ 提交失败 ${JSON.stringify(reg)}`)

// 6) 完成明细包含附件
const list = await fetch(`${BASE}/api/completion?taskId=1`, { headers: { Authorization: `Bearer ${stuToken}` } }).then(r => r.json())
const rec = (list.data || list).find(x => x.studentId === 1)
const atts = rec?.attachments || []
log(atts.length >= 1 ? `✅ 完成记录已关联附件 (${atts.length} 个), url=${atts[0].url}` : `❌ 未关联附件 ${JSON.stringify(rec)}`)

// 7) 鉴权查看附件（学生看自己的）
const view = await fetch(`${BASE}/api/uploads/${atts[0].storedName}`, { headers: { Authorization: `Bearer ${stuToken}` } })
log(view.status === 200 ? `✅ 学生可查看自己的附件 (HTTP ${view.status}, ${view.headers.get('content-type')})` : `❌ 查看失败 ${view.status}`)

// 8) 错误账号登录失败（验证之前 stu01 不再可用）
const bad = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'stu01', password: '123456' }) })
log(bad.status === 401 ? '✅ 旧账号 stu01 已失效（规范化完成）' : `⚠️ stu01 仍可登录 (${bad.status})`)

log('\n全部端到端检查完成。')
