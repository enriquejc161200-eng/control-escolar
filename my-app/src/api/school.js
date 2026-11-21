import { request } from './client';

export function getSchoolMeApi(token) {
  return request('/api/school/me', { token });
}

export function getStudentsApi(token) {
  return request('/api/school/students', { token });
}

export function createStudentApi(token, data) {
  return request('/api/school/students/accounts', { token, body: data });
}

export function getGradeCapturersApi(token) {
  return request('/api/school/grade-capturers', { token });
}

export function getStudentsForGradesApi(token, career) {
  return request(`/api/school/grade-capturers/students?career=${encodeURIComponent(career)}`, { token });
}

export function getStudentEnrollmentsForGradesApi(token, studentId) {
  return request(`/api/school/grade-capturers/students/${studentId}/enrollments`, { token });
}

export function createGradeCapturerApi(token, data) {
  return request('/api/school/grade-capturers', { token, body: data });
}

export function saveStudentApi(token, data) {
  return request('/api/school/students', { token, body: data });
}

export function updateProfileApi(token, data) {
  return request('/api/school/me/profile', { token, body: data, method: 'PUT' });
}

export function changePasswordApi(token, data) {
  return request('/api/school/me/password', { token, body: data, method: 'PUT' });
}

export function requestPasswordResetApi(token) {
  return request('/api/school/me/password-reset-request', { token, body: {} });
}

export function resetStudentPasswordApi(token, userId) {
  return request(`/api/school/students/${userId}/password`, { token, body: {}, method: 'PUT' });
}

export function setEnrollmentAuthorizationApi(token, userId, enabled) {
  return request(`/api/school/students/${userId}/enrollment-authorization`, {
    token,
    body: { enabled },
    method: 'PUT',
  });
}

export function setStudentWithdrawalApi(token, userId) {
  return request(`/api/school/students/${userId}/withdrawal`, {
    token,
    body: { withdrawn: true },
    method: 'PUT',
  });
}

export function getSubjectsApi(token) {
  return request('/api/school/subjects', { token });
}

export function createSubjectApi(token, data) {
  return request('/api/school/subjects', { token, body: data });
}

export function getEnrollmentsApi(token) {
  return request('/api/school/enrollments', { token });
}

export function requestEnrollmentApi(token, data) {
  return request('/api/school/enrollments', { token, body: data });
}

export function approveEnrollmentApi(token, enrollmentId) {
  return request(`/api/school/enrollments/${enrollmentId}/approve`, { token, body: {} });
}

export function requestCourseWithdrawalApi(token, enrollmentId, reason) {
  return request(`/api/school/enrollments/${enrollmentId}/withdrawal-request`, {
    token,
    body: { reason },
  });
}

export function approveCourseWithdrawalApi(token, enrollmentId) {
  return request(`/api/school/enrollments/${enrollmentId}/withdrawal-approval`, {
    token,
    body: {},
  });
}

export function saveGradeApi(token, studentId, enrollmentId, examType, grade) {
  return request(`/api/school/students/${studentId}/enrollments/${enrollmentId}/grade`, {
    token,
    body: { examType, grade },
    method: 'PUT',
  });
}
