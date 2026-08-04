<template>
  <div class="resources">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <div>
            <span class="h">课程资料库</span>
            <span class="sub">为小程序端提供课程资料；按年级（初一/初二/初三）+ 科目分级；免费+广告变现</span>
          </div>
          <div class="head-actions">
            <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
            <el-button :icon="Download" @click="downloadTemplate">下载模板</el-button>
            <el-upload :show-file-list="false" :auto-upload="false" accept=".json,.csv" :on-change="onFile">
              <el-button :icon="Upload" type="primary" plain>批量导入</el-button>
            </el-upload>
            <el-button type="primary" :icon="Plus" @click="openDialog()">新增资料</el-button>
          </div>
        </div>

        <!-- 筛选 -->
        <div class="filters">
          <el-select v-model="filters.grade" clearable placeholder="全部年级" style="width:140px" @change="loadAll">
            <el-option v-for="g in grades" :key="g" :label="g" :value="g" />
          </el-select>
          <el-select v-model="filters.subject" clearable placeholder="全科目" style="width:160px" @change="loadAll">
            <el-option v-for="s in subjects" :key="s" :label="s" :value="s" />
          </el-select>
          <el-input v-model="filters.keyword" placeholder="搜索标题/标签" style="width:240px" clearable @change="loadAll" />
          <span class="muted">共 {{ list.length }} 条</span>
        </div>

        <!-- 列表 -->
        <el-table :data="list" v-loading="loading" stripe border max-height="600">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="年级" width="80">
            <template #default="{ row }"><el-tag size="small">{{ row.grade }}</el-tag></template>
          </el-table-column>
          <el-table-column label="科目" width="100">
            <template #default="{ row }"><el-tag size="small" type="success">{{ row.subject }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="typeColor(row.type)">{{ typeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="source" label="来源" width="180" show-overflow-tooltip />
          <el-table-column label="数据" width="120">
            <template #default="{ row }">
              <span class="muted">👁 {{ row.view_count }}</span>
              <span class="muted" style="margin-left:8px">🎬 {{ row.unlock_count }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
              <el-button link @click="copyUrl(row)">复制链接</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing.id ? '编辑资料' : '新增资料'" width="640px" @closed="onDialogClosed">
      <el-form :model="editing" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="年级" prop="grade">
          <el-select v-model="editing.grade" placeholder="选择年级">
            <el-option v-for="g in grades" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="科目" prop="subject">
          <el-select v-model="editing.subject" placeholder="选择科目" filterable allow-create>
            <el-option v-for="s in subjects" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="editing.title" placeholder="如《春》朱自清 课文朗读" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="editing.type">
            <el-radio label="article">图文</el-radio>
            <el-radio label="video">视频</el-radio>
            <el-radio label="pdf">文档</el-radio>
            <el-radio label="link">外链</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="URL" prop="url">
          <el-input v-model="editing.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editing.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="editing.source" placeholder="如：人教社官网 CC-BY" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="tagsText" placeholder="逗号分隔，如：课文,朗读,赏析" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editing.sort_order" :min="0" :max="999" />
          <span class="muted" style="margin-left:8px">数字小靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入结果 -->
    <el-alert v-if="importResult" class="result" :type="importResult.skipped > 0 ? 'warning' : 'success'" :closable="true" show-icon @close="importResult = null">
      <template #title>
        批量导入完成：成功 {{ importResult.inserted }} 条，跳过 {{ importResult.skipped }} 条（共 {{ importResult.total }} 条）
      </template>
      <div v-if="importResult.errors.length" class="err-list">
        <div v-for="(e, i) in importResult.errors" :key="i">· {{ e }}</div>
      </div>
    </el-alert>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, Refresh, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listResources, createResource, updateResource, deleteResource, batchImportResources } from '@/api/resource'

const grades = ['初一', '初二', '初三']
const subjects = ['语文', '数学', '英语', '物理', '化学', '道德与法治', '历史', '地理', '生物', '体育', '音乐', '美术', '信息科技']

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const filters = reactive({ grade: '', subject: '', keyword: '' })
const dialogVisible = ref(false)
const editing = reactive({ id: null, grade: '', subject: '', title: '', type: 'article', url: '', description: '', source: '', sort_order: 0 })
const tagsText = ref('')
const formRef = ref()
const importResult = ref(null)

const formRules = {
  grade: [{ required: true, message: '请选择年级', trigger: 'change' }],
  subject: [{ required: true, message: '请选择科目', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  url: [{ required: true, message: '请输入 URL', trigger: 'blur' }, { type: 'url', message: 'URL 格式不正确', trigger: 'blur' }],
}

function typeLabel(t) { return ({ article: '图文', video: '视频', pdf: '文档', link: '外链' })[t] || t }
function typeColor(t) { return ({ article: 'success', video: 'warning', pdf: '', link: 'info' })[t] || '' }

async function loadAll() {
  loading.value = true
  try {
    const params = {}
    if (filters.grade) params.grade = filters.grade
    if (filters.subject) params.subject = filters.subject
    const r = await listResources(params)
    let data = r.data.list || []
    if (filters.keyword) {
      const k = filters.keyword.toLowerCase()
      data = data.filter((x) =>
        (x.title || '').toLowerCase().includes(k) ||
        (x.tags || []).some((t) => (t || '').toLowerCase().includes(k))
      )
    }
    list.value = data
  } catch (e) { ElMessage.error(e.message || '加载失败') }
  finally { loading.value = false }
}

function openDialog(row) {
  if (row) {
    Object.assign(editing, {
      id: row.id, grade: row.grade, subject: row.subject, title: row.title,
      type: row.type, url: row.url, description: row.description || '',
      source: row.source || '', sort_order: row.sort_order || 0,
    })
    tagsText.value = (row.tags || []).join(',')
  } else {
    Object.assign(editing, {
      id: null, grade: filters.grade || '初一', subject: filters.subject || '语文',
      title: '', type: 'article', url: '', description: '', source: '', sort_order: 0,
    })
    tagsText.value = ''
  }
  dialogVisible.value = true
}

async function onSave() {
  await formRef.value.validate()
  saving.value = true
  const data = {
    grade: editing.grade, subject: editing.subject, title: editing.title,
    type: editing.type, url: editing.url, description: editing.description,
    source: editing.source, sort_order: editing.sort_order,
    tags: tagsText.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
  }
  try {
    if (editing.id) await updateResource(editing.id, data)
    else await createResource(data)
    ElMessage.success(editing.id ? '已更新' : '已新增')
    dialogVisible.value = false
    loadAll()
  } catch (e) { ElMessage.error(e.message || '保存失败') }
  finally { saving.value = false }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除「${row.title}」？删除后不可恢复`, '提示', { type: 'warning' })
  try {
    await deleteResource(row.id)
    ElMessage.success('已删除')
    loadAll()
  } catch (e) { ElMessage.error(e.message || '删除失败') }
}

function copyUrl(row) {
  navigator.clipboard.writeText(row.url).then(() => ElMessage.success('链接已复制'))
}

function onDialogClosed() {
  formRef.value?.resetFields()
  tagsText.value = ''
}

// 批量导入
async function onFile(file) {
  try {
    const text = await file.raw.text()
    let items = []
    if (file.name.toLowerCase().endsWith('.json')) {
      items = JSON.parse(text)
      if (!Array.isArray(items)) throw new Error('JSON 必须是数组')
    } else {
      // 简单 CSV 解析（标题+逗号+不含引号）
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) throw new Error('CSV 至少需要表头+1行数据')
      const headers = lines[0].split(',').map((s) => s.trim())
      items = lines.slice(1).map((line) => {
        const cells = line.split(',')
        const obj = {}
        headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim() })
        if (obj.tags) obj.tags = obj.tags.split(/[|／;；]/).map((s) => s.trim()).filter(Boolean)
        return obj
      })
    }
    const r = await batchImportResources(items)
    importResult.value = r.data
    loadAll()
  } catch (e) {
    ElMessage.error('导入失败：' + e.message)
  }
}

function downloadTemplate() {
  const sample = [
    { grade: '初一', subject: '语文', title: '示例资料标题', type: 'article', url: 'https://example.com/article/1', description: '示例描述', source: '示例来源', tags: ['示例', '标签'] },
  ]
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'resources-template.json'
  a.click()
}

onMounted(loadAll)
</script>

<style scoped>
.resources { padding: 4px; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.h { font-size: 16px; font-weight: 600; margin-right: 8px; }
.sub { color: #8893ad; font-size: 13px; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.filters { display: flex; gap: 12px; align-items: center; margin: 12px 0 16px; flex-wrap: wrap; }
.muted { color: #8893ad; font-size: 12px; }
.result { margin-top: 16px; }
.err-list { margin-top: 8px; color: #c8102e; font-size: 12px; max-height: 120px; overflow: auto; }
</style>
