/**
 * 手机端表格卡片化的「字段名」数据源。
 *
 * responsive.css 在 ≤768px 时把 el-table 渲染成卡片列表，
 * 并通过 td::before { content: attr(data-label) } 在每个单元格左侧显示字段名。
 * 本模块负责把表头文字自动注入到每个 td 的 data-label 上。
 *
 * 设计要点：
 * - 仅在手机视口（≤768px）运行，桌面端零开销；
 * - MutationObserver + requestAnimationFrame 节流，表格翻页/筛选后自动重扫；
 * - 幂等：只在 label 变化时写 DOM，避免无谓重排。
 */

const LABEL_ATTR = 'data-label'
const MOBILE_QUERY = '(max-width: 768px)'

let observer = null
let rafId = null

const isMobile = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia(MOBILE_QUERY).matches

/** 同步单个表格：把表头文字写入每行 td 的 data-label */
function syncTable(table) {
  const thCells = table.querySelectorAll('.el-table__header-wrapper th .cell')
  if (!thCells.length) return

  // 表头文字（去掉排序图标等空白字符）
  const labels = Array.from(thCells, (th) => (th.textContent || '').trim())
  const rows = table.querySelectorAll('.el-table__body-wrapper tbody tr')

  rows.forEach((tr) => {
    const tds = tr.querySelectorAll('td.el-table__cell')
    tds.forEach((td, i) => {
      const label = labels[i] ?? ''
      if (td.getAttribute(LABEL_ATTR) !== label) {
        td.setAttribute(LABEL_ATTR, label)
      }
    })
  })
}

function syncAll() {
  if (!isMobile()) return // 桌面端不需要
  document.querySelectorAll('.el-table').forEach(syncTable)
}

function schedule() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    syncAll()
  })
}

/** 在 main.js 中调用一次即可 */
export function installTableCard() {
  if (typeof window === 'undefined' || observer) return

  // 首次立即同步
  schedule()

  // 表格 DOM 变化（翻页 / 筛选 / 路由切换）后重扫
  observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  // 视口切换（旋转屏幕 / resize 到手机尺寸）后重扫
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
}

/** 卸载（一般无需调用） */
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
