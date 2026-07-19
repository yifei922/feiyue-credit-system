import request from './request'
import { mockApi } from './mock'

export function dashboardOverview() {
  if (mockApi.useMock) return mockApi.dashboardOverview()
  return request.get('/api/dashboard/overview')
}

export function creditTrend(studentId) {
  if (mockApi.useMock) return mockApi.creditTrend(studentId)
  return request.get('/api/dashboard/credit-trend', { params: { studentId } })
}

export function drillDownSubject(subjectId) {
  if (mockApi.useMock) return mockApi.drillDownSubject(subjectId)
  return request.get('/api/dashboard/drill/subject', { params: { subjectId } })
}

export function drillDownStatus(status) {
  if (mockApi.useMock) return mockApi.drillDownStatus(status)
  return request.get('/api/dashboard/drill/status', { params: { status } })
}
