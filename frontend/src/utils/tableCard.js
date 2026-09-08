/**
 * 手机端表格卡片化 + 关键字段高亮 + 操作按钮语义色
 *
 * responsive.css 在 ≤768px 时把 el-table 渲染成卡片列表。
 * 本模块负责：
 *   ① 表头文字注入 td.data-label（字段名）
 *   ② 关键字段（姓名/学分/身份）注入 td.key-* class（视觉强调）
 *   ③ 操作列按钮按文字注入 .sem-* class（删除=红/重置=蓝/课代表=橙/学分=绿/其他=紫）
 *
 * 设计要点：
 *   - 仅在手机视口运行，桌面端零开销；
 *   - MutationObserver + requestAnimationFrame 节流，表格翻页/筛选后自动重扫；
 *   - 幂等：只在变化时写 DOM，避免无谓重排；
 *   - 字段名→class 的映射集中可扩展（KEY_FIELDS）；
 *   - 按钮文字→语义色用「关键词包含」匹配，兼容多种文案。
 */

const LABEL_ATTR = 'data-label'
const KEY_CLASS_PREFIX = 'key-'
const SEM_CLASS_PREFIX = 'sem-'
const OP_CLASS = 'op-col'
const MOBILE_QUERY = '(max-width: 768px)'

/* 字段名 → 注入到 td 的额外 class（CSS 据此给视觉强调）
 * 精确匹配优先，未命中走「包含」匹配。
 */
const KEY_FIELDS = [
  // 姓名 / 标题类
  { cls: 'key-name',  labels: ['姓名', '学生姓名', '用户名', '课代表', '作者'] },
  { cls: 'key-title', labels: ['标题', '任务标题', '名称', '文件名', '任务', '徽名'] },
  // 学分类
  { cls: 'key-credit', labels: ['学分', '总学分', '本次学分', 'creditvalue', '积分'] },
  // 身份 / 角色
  { cls: 'key-role',     labels: ['角色', '权限'] },
  { cls: 'key-identity', labels: ['身份'] },
  // 性别
  { cls: 'key-gender',   labels: ['性别'] },
  // 状态
  { cls: 'key-status',   labels: ['状态', '完成状态', '任务状态'] },
]

/* 按钮文字（包含匹配）→ 语义色。注意顺序：从具体到通用。 */
const SEM_BUTTON_RULES = [
  { sem: 'danger',  keywords: ['删除', '清空', '移除', '注销'] },
  { sem: 'warning', keywords: ['设为课代表', '取消课代表', '课代表', '警告'] },
  { sem: 'info',    keywords: ['重置', '修改密码', '密码', '编辑', '详情', '查看', '登记', '颁发', '撤销', '设为已完成'] },
  { sem: 'success', keywords: ['完成', '确认', '提交', '保存', '通过', '已颁发', '加分', '减分', '学分增减', '设为未完成'] },
  // fallback: primary（品牌紫）
]

let observer = null
let rafId = null

const isMobile = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia(MOBILE_QUERY).matches

/** 从 KEY_FIELDS 找出表头 label 对应的 key-* class */
function pickKeyClass(label) {
  if (!label) return null
  const norm = label.toLowerCase().trim()
  for (const rule of KEY_FIELDS) {
    for (const l of rule.labels) {
      if (norm === l.toLowerCase()) return rule.cls
    }
  }
  for (const rule of KEY_FIELDS) {
    for (const l of rule.labels) {
      if (norm.includes(l.toLowerCase())) return rule.cls
    }
  }
  return null
}

/** 从按钮文字找出语义色 */
function pickSemClass(text) {
  if (!text) return null
  const t = text.trim()
  if (!t) return null
  for (const rule of SEM_BUTTON_RULES) {
    for (const kw of rule.keywords) {
      if (t.includes(kw)) return rule.cls
    }
  }
  return 'primary' // fallback：品牌色
}

/** 同步单个表格 */
function syncTable(table) {
  const thCells = table.querySelectorAll('.el-table__header-wrapper th .cell')
  if (!thCells.length) return

  // 每列：{ label, isOp } —— 操作列 label 为空或含"操作"二字
  const cols = Array.from(thCells, (th) => {
    const label = (th.textContent || '').trim()
    const isOp = label === '' || label.includes('操作')
    return { label, isOp }
  })

  const rows = table.querySelectorAll('.el-table__body-wrapper tbody tr')
  rows.forEach((tr) => {
    const tds = tr.querySelectorAll('td.el-table__cell')
    tds.forEach((td, i) => {
      const col = cols[i] || { label: '', isOp: false }
      const label = col.label

      // 1) data-label
      if (td.getAttribute(LABEL_ATTR) !== label) {
        td.setAttribute(LABEL_ATTR, label)
      }

      // 2) key-* class（先清再加，避免脏 class）
      const wantKey = col.isOp ? null : pickKeyClass(label)
      Array.from(td.classList).forEach((c) => {
        if (c.startsWith(KEY_CLASS_PREFIX)) td.classList.remove(c)
      })
      if (wantKey) td.classList.add(wantKey)

      // 3) 操作列：注入 op-col + 按钮语义色
      if (col.isOp) {
        if (!td.classList.contains(OP_CLASS)) td.classList.add(OP_CLASS)
        const btns = td.querySelectorAll('.cell .el-button')
        btns.forEach((btn) => {
          const sem = pickSemClass(btn.textContent)
          if (sem) {
            Array.from(btn.classList).forEach((c) => {
              if (c.startsWith(SEM_CLASS_PREFIX)) btn.classList.remove(c)
            })
            btn.classList.add(SEM_CLASS_PREFIX + sem)
          }
        })
      } else if (td.classList.contains(OP_CLASS)) {
        td.classList.remove(OP_CLASS)
      }
    })
  })
}

function syncAll() {
  if (!isMobile()) return
  document.querySelectorAll('.el-table').forEach(syncTable)
}

function schedule() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    syncAll()
  })
}

export function installTableCard() {
  if (typeof window === 'undefined' || observer) return
  schedule()
  observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
}

export function uninstallTableCard() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  window.removeEventListener('resize', schedule)
  window.removeEventListener('orientationchange', schedule)
}