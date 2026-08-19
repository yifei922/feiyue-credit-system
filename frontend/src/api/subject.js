import request from './request'

// 科目列表（含课代表信息）。platform: WEB=初二学科体系 / MP=中性兴趣科目（默认 WEB）
export function listSubjects(platform = 'WEB') {
  return request.get('/api/subjects', { params: { platform } })
}

// 设置某科目的课代表
export function setSubjectReps(subjectId, userIds) {
  return request.post(`/api/subjects/${subjectId}/reps`, { userIds })
}

// 新增科目（支持自定义科目名称 + 平台）
export function createSubject(data) {
  return request.post('/api/subjects', data)
}

// 更新科目
export function updateSubject(id, data) {
  return request.put(`/api/subjects/${id}`, data)
}

// 删除科目
export function deleteSubject(id) {
  return request.delete(`/api/subjects/${id}`)
}
