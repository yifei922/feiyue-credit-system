import request from './request'

// 科目列表（含课代表信息）
export function listSubjects() {
  return request.get('/api/subjects')
}

// 设置某科目的课代表
export function setSubjectReps(subjectId, userIds) {
  return request.post(`/api/subjects/${subjectId}/reps`, { userIds })
}
