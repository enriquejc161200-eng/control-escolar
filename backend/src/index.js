'use strict';

const crypto = require('node:crypto');
const CURRICULUM = [
  {
    semester: 1,
    career: 'all',
    names: [
      'Álgebra superior',
      'Cálculo I',
      'El ingeniero y su entorno socioeconómico',
      'Física',
      'Geometría analítica',
      'Programación I',
    ],
  },
  {
    semester: 2,
    career: 'ICO',
    names: [
      'Álgebra lineal',
      'Cálculo II',
      'Ecuaciones diferenciales',
      'Epistemología',
      'Química',
      'Inglés 5',
      'Programación II',
    ],
  },
  {
    semester: 3,
    career: 'ICO',
    names: [
      'Cálculo III',
      'Comunicación y relaciones humanas',
      'Matemáticas discretas',
      'Probabilidad y estadística',
      'Inglés 6',
      'Bases de datos I',
      'Paradigmas de programación I',
    ],
  },
  {
    semester: 4,
    career: 'ICO',
    names: [
      'Electromagnetismo',
      'Inglés 7',
      'Arquitectura de computadoras',
      'Bases de datos II',
      'Métodos estadísticos',
      'Métodos numéricos',
      'Paradigmas de programación II',
    ],
  },
  {
    semester: 5,
    career: 'ICO',
    names: [
      'Inglés 8',
      'Circuitos eléctricos y electrónicos',
      'Ensambladores',
      'Ingeniería de software I',
      'Inteligencia artificial',
      'Transmisión de datos',
      'Investigación de operaciones',
    ],
  },
  {
    semester: 6,
    career: 'ICO',
    names: [
      'Administración de recursos informáticos',
      'Compiladores',
      'Ingeniería de software II',
      'Procesamiento de imágenes digitales',
      'Protocolos de comunicación de datos',
      'Sistemas analógicos',
    ],
  },
  {
    semester: 7,
    career: 'ICO',
    names: [
      'Administración de proyectos informáticos',
      'Arquitectura de redes',
      'Graficación computacional',
      'Robótica',
      'Sistemas digitales',
      'Sistemas operativos',
      'Ciencia de los datos',
    ],
  },
  {
    semester: 8,
    career: 'ICO',
    isElective: true,
    names: [
      'Seguridad de la información',
      'Ética profesional y sustentabilidad',
      'Gestión de proyectos de investigación',
      'Sistemas embebidos',
      'Tecnologías computacionales I',
      'Integrativa profesional',
      'Análisis y diseño de redes',
      'Reconocimiento de patrones',
      'Visión artificial',
      'Normatividad de la inteligencia artificial',
      'Gobernanza de TI',
      'Realidad virtual y aumentada',
      'Web services',
      'Diseño y programación de videojuegos',
      'Auditoría informática',
      'Microservicios',
    ],
  },
  {
    semester: 9,
    career: 'ICO',
    isElective: true,
    names: [
      'Proyecto integral de comunicación de datos',
      'Proyecto integral de ingeniería de software',
      'Tecnologías computacionales II',
      'Computing in Industry',
      'Gestión de redes',
      'Interacción hombre-máquina',
      'Sistemas interactivos',
      'Tecnologías emergentes',
      'Tópicos de tecnologías de datos',
      'Machine learning',
      'Deep learning',
      'Ciberseguridad',
      'Knowledge representation',
      'Artificial intelligence IoT',
      'Instrumentación y automatización',
      'Principios SOLID y patrones de diseño',
      'Cómputo cuántico',
    ],
  },
  {
    semester: 10,
    career: 'ICO',
    names: ['Práctica profesional'],
  },
];

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advancedSettings = await pluginStore.get({ key: 'advanced' });

    if (advancedSettings?.default_role !== 'authenticated') {
      await pluginStore.set({
        key: 'advanced',
        value: { ...advancedSettings, default_role: 'authenticated' },
      });
    }
    if (advancedSettings?.allow_register !== false) {
      await pluginStore.set({
        key: 'advanced',
        value: { ...advancedSettings, default_role: 'authenticated', allow_register: false },
      });
    }

    const roles = strapi.db.query('plugin::users-permissions.role');
    const adminRole = await roles.findOne({ where: { type: 'school_admin' } });
    if (!adminRole) {
      await roles.create({
        data: {
          name: 'Administrador escolar',
          type: 'school_admin',
          description: 'Puede dar de alta y actualizar los datos escolares.',
        },
      });
    }

    const gradeRole = await roles.findOne({ where: { type: 'school_grade_capturer' } });
    if (!gradeRole) {
      await roles.create({
        data: {
          name: 'Capturista de calificaciones',
          type: 'school_grade_capturer',
          description: 'Puede consultar materias inscritas y capturar calificaciones.',
        },
      });
    }

    const schoolAdminRole = await roles.findOne({ where: { type: 'school_admin' } });
    const gradeCapturerRole = await roles.findOne({ where: { type: 'school_grade_capturer' } });
    if (!schoolAdminRole || !gradeCapturerRole) {
      throw new Error('No se pudieron inicializar los roles escolares');
    }

    const permissions = strapi.db.query('plugin::users-permissions.permission');
    const ensureRolePermissions = async (role, actions) => {
      for (const action of actions) {
        const existing = await permissions.findOne({
          where: { action, role: { id: role.id } },
        });
        if (!existing) {
          await permissions.create({ data: { action, role: role.id } });
        }
      }
    };

    await ensureRolePermissions(schoolAdminRole, [
      'plugin::users-permissions.user.me',
      'api::school.school.me',
      'api::school.school.findStudents',
      'api::school.school.createStudent',
      'api::school.school.resetStudentPassword',
      'api::school.school.findGradeCapturers',
      'api::school.school.createGradeCapturer',
      'api::school.school.updateProfile',
      'api::school.school.saveStudent',
      'api::school.school.setEnrollmentAuthorization',
      'api::school.school.setStudentWithdrawal',
      'api::school.school.findSubjects',
      'api::school.school.createSubject',
      'api::school.school.findEnrollments',
      'api::school.school.approveEnrollment',
      'api::school.school.approveCourseWithdrawal',
    ]);
    await ensureRolePermissions(gradeCapturerRole, [
      'plugin::users-permissions.user.me',
      'api::school.school.me',
      'api::school.school.findStudentsForGrades',
      'api::school.school.findStudentEnrollmentsForGrades',
      'api::school.school.findSubjects',
      'api::school.school.findEnrollments',
      'api::school.school.saveGrade',
    ]);

    const studentRole = await roles.findOne({ where: { type: 'authenticated' } });
    if (studentRole) {
      await ensureRolePermissions(studentRole, [
        'plugin::users-permissions.user.me',
        'api::school.school.me',
        'api::school.school.updateProfile',
        'api::school.school.changePassword',
        'api::school.school.requestPasswordReset',
        'api::school.school.findSubjects',
        'api::school.school.findEnrollments',
        'api::school.school.requestEnrollment',
        'api::school.school.requestCourseWithdrawal',
      ]);
    }

    const subjects = strapi.db.query('api::subject.subject');
    for (const period of CURRICULUM) {
      for (const [index, name] of period.names.entries()) {
        const code = period.semester === 10
          ? '999'
          : `${period.semester}${String(index + 1).padStart(2, '0')}`;
        const existing = await subjects.findOne({ where: { code } });
        if (existing) {
          if (
            existing.name !== name ||
            existing.semester !== period.semester
          ) {
            throw new Error(`El código de materia ${code} ya está asignado a otra materia`);
          }
          const isElective = period.semester === 8
            ? index >= 6
            : period.semester === 9
              ? index >= 3
              : false;
          if (
            (existing.career ?? 'all') !== period.career ||
            existing.credits !== 5 ||
            Boolean(existing.isElective) !== isElective
          ) {
            await subjects.update({
              where: { id: existing.id },
              data: { career: period.career, credits: 5, isElective },
            });
          }
          continue;
        }
        const isElective = period.semester === 8
          ? index >= 6
          : period.semester === 9
            ? index >= 3
            : false;
        await subjects.create({
          data: {
            name,
            code,
            credits: 5,
            semester: period.semester,
            career: period.career,
            isElective,
          },
        });
      }
    }

    const firstSemesterSubjects = await subjects.findMany({ where: { semester: 1 } });
    const firstSemesterRecords = await strapi.db
      .query('api::student-record.student-record')
      .findMany({
        where: { semester: 1 },
        populate: { user: { select: ['id'] } },
      });
    const enrollments = strapi.db.query('api::course-enrollment.course-enrollment');
    for (const record of firstSemesterRecords) {
      if (!record.user) continue;
      let requestBatch = record.semesterBatch;
      if (!requestBatch) {
        requestBatch = crypto.randomUUID();
        await strapi.db.query('api::student-record.student-record').update({
          where: { id: record.id },
          data: { semesterBatch: requestBatch },
        });
      }
      const currentEnrollments = await enrollments.findMany({
        where: { user: { id: record.user.id } },
        populate: { subject: { select: ['id'] } },
      });
      const assignedIds = new Set(currentEnrollments.map((item) => item.subject?.id));
      for (const subject of firstSemesterSubjects) {
        if (!['all', record.career].includes(subject.career ?? 'all')) continue;
        if (assignedIds.has(subject.id)) continue;
        await enrollments.create({
          data: {
            user: record.user.id,
            subject: subject.id,
            status: 'enrolled',
            attempt: 1,
            semester: 1,
            requestBatch,
            advancesSemester: true,
            countsTowardProgress: true,
            schedule: 'Inscripción inicial automática',
          },
        });
      }
    }

    const users = strapi.db.query('plugin::users-permissions.user');
    const createInitialAccount = async ({ username, email, password, role }) => {
      const existing = await users.findOne({
        where: { $or: [{ username }, { email }] },
        populate: ['role'],
        select: ['id'],
      });
      if (existing) {
        if (existing.role?.id !== role.id) {
          throw new Error(`La cuenta inicial "${username}" ya existe con un rol diferente`);
        }
        return;
      }
      await strapi.plugin('users-permissions').service('user').add({
        username,
        email,
        password,
        provider: 'local',
        confirmed: true,
        role: role.id,
      });
    };

    await createInitialAccount({
      username: 'admin',
      email: 'admin@control-escolar.mx',
      password: 'admin123',
      role: schoolAdminRole,
    });
    await createInitialAccount({
      username: 'calificaciones',
      email: 'calificaciones@control-escolar.mx',
      password: 'calificaciones',
      role: gradeCapturerRole,
    });
  },
};
