'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/school/me',
      handler: 'school.me',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/students',
      handler: 'school.findStudents',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/students/accounts',
      handler: 'school.createStudent',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/grade-capturers',
      handler: 'school.findGradeCapturers',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/grade-capturers',
      handler: 'school.createGradeCapturer',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/grade-capturers/students',
      handler: 'school.findStudentsForGrades',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/grade-capturers/students/:studentId/enrollments',
      handler: 'school.findStudentEnrollmentsForGrades',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/students',
      handler: 'school.saveStudent',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/me/profile',
      handler: 'school.updateProfile',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/me/password',
      handler: 'school.changePassword',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/me/password-reset-request',
      handler: 'school.requestPasswordReset',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/students/:id/password',
      handler: 'school.resetStudentPassword',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/students/:id/enrollment-authorization',
      handler: 'school.setEnrollmentAuthorization',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/students/:id/withdrawal',
      handler: 'school.setStudentWithdrawal',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/subjects',
      handler: 'school.findSubjects',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/subjects',
      handler: 'school.createSubject',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/school/enrollments',
      handler: 'school.findEnrollments',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/enrollments',
      handler: 'school.requestEnrollment',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/enrollments/:id/approve',
      handler: 'school.approveEnrollment',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/enrollments/:id/withdrawal-request',
      handler: 'school.requestCourseWithdrawal',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/school/enrollments/:id/withdrawal-approval',
      handler: 'school.approveCourseWithdrawal',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/school/students/:studentId/enrollments/:enrollmentId/grade',
      handler: 'school.saveGrade',
      config: { auth: {} },
    },
  ],
};
