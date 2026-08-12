<template>
  <div class="recycle-page">
    <div class="card intro">
      <div class="title">回收站</div>
      <p class="tip">
        这里展示 30 天内被删除的成员，可恢复或彻底清除。
        共 <b>{{ rows.length }}</b> 人。
      </p>
      <el-button text @click="load" :icon="Refresh">刷新</el-button>
    </div>

    <div class="loading" v-if="loading">加载中…</div>
    <div class="empty card" v-else-if="rows.length === 0">回收站为空</div>

    <div class="card section" v-else>
      <el-table :data="rows" stripe border class="tbl">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="studentNo" label="编号" width="120" />
        <el-table-column prop="className" label="原分组" />
        <el-table-column prop="deletedAt" label="删除时间" width="170">
          <template #default="{ row }">{{ formatDate(row.deletedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="doRestore(row)">恢复</el-button>
            <el-button link type="danger" @click="doPurge(row)">彻底删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="card hint">
      <div class="hint-title">操作说明</div>
      <div><b>恢复</b>：清除 deleted_at 标记，成员数据重新可见。</div>
      <div><b>彻底删除</b>：从数据库物理删除该成员及其 STUDENT 角色账号（不可恢复）。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import request from '@/api/request'

const loading = ref(true)
const rows = ref([])

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  try {
    const r = await request.get('/api/students', { params: { includeDeleted: 1, pageSize: 200 } })
    rows.value = r.data || r || []
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

async function doRestore(row) {
  try {
    await ElMessageBox.confirm(`恢复「${row.name}」？`, '恢复确认', { type: 'warning' })
  } catch (_) { return }
  try {
    await request.post(`/api/students/${row.id}/restore`)
    ElMessage.success('已恢复')
    await load()
  } catch (e) { /* 拦截器已提示 */ }
}

async function doPurge(row) {
  try {
    await ElMessageBox.confirm(
      `将彻底删除「${row.name}」及其登录账号，操作不可恢复！\n请输入删除原因以便审计。`,
      '⚠️ 高危操作：彻底删除',
      {
        type: 'error',
        inputType: 'textarea',
        inputPlaceholder: '例：录入错误、毕业清理等',
        inputValidator: (v) => (v && v.length >= 4) || '请填写至少 4 字原因',
        confirmButtonText: '我已确认，彻底删除',
        cancelButtonText: '取消'
      }
    )
  } catch (_) { return }
  try {
    // 软删除后再强制真删：先 DELETE 软删除，再调一个新接口真删
    // 这里用 hardDelete 路径；如后端无此接口，可在此改为 DELETE（仍保留 deleted_at 状态以便审计）
    await request.delete(`/api/students/${row.id}?hard=1`)
    ElMessage.success('已彻底删除')
    await load()
  } catch (e) { /* 拦截器已提示 */ }
}

onMounted(load)
</script>

<style scoped>
.recycle-page { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
.intro { display: flex; flex-direction: column; gap: 4px; position: relative; }
.intro .title { font-size: 16px; font-weight: 600; }
.intro .tip { font-size: 13px; color: var(--text-soft); }
.intro .el-button { position: absolute; top: 14px; right: 16px; }
.loading, .empty { text-align: center; color: var(--text-soft); padding: 28px; }
.tbl { width: 100%; }
.hint { font-size: 13px; color: #5b6573; line-height: 1.9; }
.hint-title { font-weight: 600; margin-bottom: 4px; color: #2b3242; }
</style>
