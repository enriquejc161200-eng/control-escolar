'use strict';

const crypto = require('node:crypto');
const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const RECORD_UID = 'api::student-record.student-record';
const SUBJECT_UID = 'api::subject.subject';
const ENROLLMENT_UID = 'api::course-enrollment.course-enrollment';
const ADMIN_ROLE = 'school_admin';
const GRADE_CAPTURER_ROLE = 'school_grade_capturer';
const STUDENT_ROLE = 'authenticated';
const CAREERS = ['ICO', 'ICI', 'ISES', 'IME', 'IEE', 'IA'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const { ForbiddenError, UnauthorizedError } = require('@strapi/utils').errors;

const requireUser = (ctx) => {
  if (!ctx.state.user) throw new UnauthorizedError('Debes iniciar sesión');
  return ctx.state.user;
};

const requireAdmin = (ctx) => {
  const user = requireUser(ctx);
  if (user.role?.type !== ADMIN_ROLE) {
    throw new ForbiddenError('Solo el administrador puede gestionar los datos escolares');
  }
  return user;
};

const requireGradeAccess = (ctx) => {
  const user = requireUser(ctx);
  if (user.role?.type !== GRADE_CAPTURER_ROLE) {
    throw new ForbiddenError('No tienes permiso para consultar las calificaciones');
  }
  return user;
};

const publicRecord = (record) => {
  if (!record) return null;
  const [legacyFirstName = '', ...legacyLastName] = (record.fullName ?? '').trim().split(/\s+/);
  const firstName = record.firstName ?? legacyFirstName;
  const lastName = record.lastName ?? legacyLastName.join(' ');
  return {
    semester: record.semester,
    average: record.average,
    academicStatus: record.academicStatus,
    address: record.address ?? '',
    contactPhone: record.contactPhone ?? '',
    contactEmail: record.contactEmail ?? '',
    parentNames: record.parentNames ?? '',
    bloodType: record.bloodType ?? '',
    postalCode: record.postalCode ?? '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    career: record.career ?? '',
    accountNumber: record.accountNumber ?? '',
    enrollmentEnabled: Boolean(record.enrollmentEnabled),
    withdrawalEligible: Boolean(record.withdrawalEligible),
    withdrawn: Boolean(record.withdrawn),
    passwordResetRequested: Boolean(record.passwordResetRequested),
  };
};

const publicSubject = (subject) => ({
  id: subject.id,
  name: subject.name,
  code: subject.code,
  credits: subject.credits,
  semester: subject.semester,
  career: subject.career ?? 'all',
  isElective: Boolean(subject.isElective),
});

const publicEnrollment = (enrollment) => ({
  id: enrollment.id,
  status: enrollment.status,
  grade: enrollment.grade,
  ordinaryGrade: enrollment.ordinaryGrade ?? null,
  extraGrade: enrollment.extraGrade ?? null,
  titleGrade: enrollment.titleGrade ?? null,
  withdrawalRequested: Boolean(enrollment.withdrawalRequested),
  withdrawalReason: enrollment.withdrawalReason ?? '',
  attempt: enrollment.attempt,
  countsTowardProgress: enrollment.countsTowardProgress !== false,
  semester: enrollment.semester ?? null,
  schedule: enrollment.schedule ?? '',
  subject: enrollment.subject ? publicSubject(enrollment.subject) : null,
  student: enrollment.user
    ? { id: enrollment.user.id, username: enrollment.user.username }
    : null,
});

const getRecord = (userId) =>
  strapi.db.query(RECORD_UID).findOne({ where: { user: { id: userId } } });

const assignFirstSemesterSubjects = async (userId, record, subjects) => {
  if (record.semester !== 1 || !subjects.length) return;
  let batch = record.semesterBatch;
  if (!batch) {
    batch = crypto.randomUUID();
    await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: { semesterBatch: batch },
    });
  }
  const enrollments = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: { user: { id: userId } },
    populate: { subject: { select: ['id'] } },
  });
  const assignedIds = new Set(enrollments.map((enrollment) => enrollment.subject?.id));

  for (const subject of subjects) {
    if (
      subject.semester !== 1 ||
      !['all', record.career].includes(subject.career ?? 'all') ||
      assignedIds.has(subject.id)
    ) continue;
    await strapi.db.query(ENROLLMENT_UID).create({
      data: {
        user: userId,
        subject: subject.id,
        status: 'enrolled',
        attempt: 1,
        semester: 1,
        requestBatch: batch,
        advancesSemester: true,
        countsTowardProgress: true,
        schedule: 'Inscripción inicial automática',
      },
    });
  }
};

module.exports = {
  async me(ctx) {
    const user = requireUser(ctx);
    const role = user.role?.type;
    if (![ADMIN_ROLE, GRADE_CAPTURER_ROLE, STUDENT_ROLE].includes(role)) {
      throw new ForbiddenError('Tu cuenta no tiene un rol escolar válido');
    }

    ctx.body = {
      role,
      user: { id: user.id, username: user.username, email: user.email },
      record: role === STUDENT_ROLE ? publicRecord(await getRecord(user.id)) : null,
    };
  },

  async findStudents(ctx) {
    requireAdmin(ctx);
    const users = await strapi.db.query(USER_UID).findMany({
      where: { role: { type: STUDENT_ROLE } },
      select: ['id', 'username', 'email'],
      orderBy: { username: 'asc' },
    });
    const records = await strapi.db.query(RECORD_UID).findMany({
      populate: { user: { select: ['id'] } },
    });
    const recordsByUserId = new Map(records.map((record) => [record.user?.id, publicRecord(record)]));
    ctx.body = {
      students: users.map((user) => ({
        ...user,
        record: recordsByUserId.get(user.id) ?? null,
      })),
    };
  },

  async createStudent(ctx) {
    requireAdmin(ctx);
    const { firstName, lastName, career } = ctx.request.body ?? {};
    if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim()) {
      return ctx.badRequest('El nombre y los apellidos son obligatorios');
    }
    if (!CAREERS.includes(career)) return ctx.badRequest('Selecciona una carrera válida');

    const studentRole = await strapi.db.query(ROLE_UID).findOne({ where: { type: STUDENT_ROLE } });
    if (!studentRole) throw new Error('No existe el rol de alumno configurado');

    let accountNumber;
    let available = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = String(crypto.randomInt(1_000_000, 10_000_000));
      const [existingUser, existingRecord] = await Promise.all([
        strapi.db.query(USER_UID).findOne({
          where: {
            $or: [
              { username: candidate },
              { email: `${candidate}@alumnos.control-escolar.mx` },
            ],
          },
          select: ['id'],
        }),
        strapi.db.query(RECORD_UID).findOne({
          where: { accountNumber: candidate },
          select: ['id'],
        }),
      ]);
      if (!existingUser && !existingRecord) {
        accountNumber = candidate;
        available = true;
        break;
      }
    }
    if (!available) throw new Error('No se pudo generar un número de cuenta único. Intenta de nuevo.');

    const user = await strapi.plugin('users-permissions').service('user').add({
      username: accountNumber,
      email: `${accountNumber}@alumnos.control-escolar.mx`,
      password: accountNumber,
      provider: 'local',
      confirmed: true,
      role: studentRole.id,
    });
    const record = await strapi.db.query(RECORD_UID).create({
      data: {
        user: user.id,
        semester: 1,
        semesterBatch: crypto.randomUUID(),
        average: 0,
        academicStatus: 'regular',
        enrollmentEnabled: false,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        career,
        accountNumber,
      },
    });
    const firstSemesterSubjects = await strapi.db.query(SUBJECT_UID).findMany({
      where: { semester: 1 },
    });
    await assignFirstSemesterSubjects(user.id, record, firstSemesterSubjects);
    ctx.body = {
      student: {
        id: user.id,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        career,
        accountNumber,
        initialPassword: accountNumber,
      },
    };
  },

  async findGradeCapturers(ctx) {
    requireAdmin(ctx);
    const users = await strapi.db.query(USER_UID).findMany({
      where: { role: { type: GRADE_CAPTURER_ROLE } },
      select: ['id', 'username', 'email'],
      orderBy: { username: 'asc' },
    });
    ctx.body = { capturers: users };
  },

  async createGradeCapturer(ctx) {
    requireAdmin(ctx);
    const { username, email, password } = ctx.request.body ?? {};
    if (typeof username !== 'string' || username.trim().length < 3) {
      return ctx.badRequest('El nombre debe tener al menos 3 caracteres');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.badRequest('Ingresa un correo electrónico válido');
    }
    if (typeof password !== 'string' || password.length < 6) {
      return ctx.badRequest('La contraseña debe tener al menos 6 caracteres');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await strapi.db.query(USER_UID).findOne({
      where: { $or: [{ email: normalizedEmail }, { username: username.trim() }] },
      select: ['id'],
    });
    if (existing) return ctx.badRequest('El correo o nombre de usuario ya está registrado');

    const role = await strapi.db.query(ROLE_UID).findOne({ where: { type: GRADE_CAPTURER_ROLE } });
    if (!role) throw new Error('No existe el rol de captura de calificaciones configurado');
    const user = await strapi.plugin('users-permissions').service('user').add({
      username: username.trim(),
      email: normalizedEmail,
      password,
      provider: 'local',
      confirmed: true,
      role: role.id,
    });
    ctx.body = { capturer: { id: user.id, username: user.username, email: user.email } };
  },

  async saveStudent(ctx) {
    requireAdmin(ctx);
    const { userId, semester, average, academicStatus } = ctx.request.body ?? {};
    const parsedUserId = Number(userId);
    const parsedSemester = Number(semester);
    const parsedAverage = Number(typeof average === 'string' ? average.replace(',', '.') : average);
    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return ctx.badRequest('Selecciona un alumno válido');
    if (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 10) {
      return ctx.badRequest('El periodo de la materia debe estar entre 1 y 10');
    }
    if (!Number.isFinite(parsedAverage) || parsedAverage < 0 || parsedAverage > 10) {
      return ctx.badRequest('El promedio debe estar entre 0 y 10');
    }
    if (!['regular', 'irregular'].includes(academicStatus)) {
      return ctx.badRequest('Selecciona una situación académica válida');
    }
    const student = await strapi.db.query(USER_UID).findOne({
      where: { id: parsedUserId },
      populate: ['role'],
      select: ['id'],
    });
    if (!student || student.role?.type !== STUDENT_ROLE) return ctx.badRequest('La cuenta seleccionada no es un alumno');

    const data = { semester: parsedSemester, average: parsedAverage, academicStatus };
    const existingRecord = await getRecord(student.id);
    const record = existingRecord
      ? await strapi.db.query(RECORD_UID).update({ where: { id: existingRecord.id }, data })
      : await strapi.db.query(RECORD_UID).create({ data: { ...data, user: student.id } });
    ctx.body = { record: publicRecord(record) };
  },

  async updateProfile(ctx) {
    const user = requireUser(ctx);
    if (user.role?.type !== STUDENT_ROLE) throw new ForbiddenError('Solo el alumno puede actualizar sus datos personales');
    const {
      firstName,
      lastName,
      address,
      contactPhone,
      contactEmail,
      parentNames,
      bloodType,
      postalCode,
    } = ctx.request.body ?? {};
    const profile = { firstName, lastName, address, contactPhone, contactEmail, parentNames, bloodType, postalCode };
    if (Object.values(profile).some((value) => typeof value !== 'string' || !value.trim())) {
      return ctx.badRequest('Completa nombre, apellidos y todos los datos personales solicitados');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return ctx.badRequest('Ingresa un correo de contacto válido');
    }
    if (!/^\d{10}$/.test(contactPhone.trim())) {
      return ctx.badRequest('El teléfono de contacto debe contener exactamente 10 dígitos');
    }
    if (!BLOOD_TYPES.includes(bloodType.trim())) {
      return ctx.badRequest('Selecciona un tipo de sangre válido');
    }
    if (!/^\d{5}$/.test(postalCode.trim())) return ctx.badRequest('El código postal debe contener 5 dígitos');

    const record = await getRecord(user.id);
    if (!record) return ctx.badRequest('El administrador debe dar de alta tu cuenta escolar');
    if (record.withdrawn) return ctx.forbidden('Tu cuenta está dada de baja y solo puedes consultar tu información');
    const updated = await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: {
        ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
      },
    });
    ctx.body = { record: publicRecord(updated) };
  },

  async changePassword(ctx) {
    const user = requireUser(ctx);
    if (user.role?.type !== STUDENT_ROLE) {
      throw new ForbiddenError('Solo el alumno puede cambiar su contraseña desde el portal');
    }
    const record = await getRecord(user.id);
    if (record?.withdrawn) return ctx.forbidden('Tu cuenta está dada de baja y no puedes modificar tus datos');
    const { currentPassword, newPassword, confirmPassword } = ctx.request.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return ctx.badRequest('Completa la contraseña actual y la nueva contraseña');
    }
    if (newPassword.length < 6) return ctx.badRequest('La nueva contraseña debe tener al menos 6 caracteres');
    if (newPassword !== confirmPassword) return ctx.badRequest('Las nuevas contraseñas no coinciden');

    const currentUser = await strapi.db.query(USER_UID).findOne({
      where: { id: user.id },
      select: ['id', 'password'],
    });
    const bcrypt = require('bcryptjs');
    if (!currentUser?.password || !(await bcrypt.compare(currentPassword, currentUser.password))) {
      return ctx.badRequest('La contraseña actual es incorrecta');
    }
    await strapi.plugin('users-permissions').service('user').edit(user.id, { password: newPassword });
    ctx.body = { message: 'La contraseña se cambió correctamente' };
  },

  async requestPasswordReset(ctx) {
    const user = requireUser(ctx);
    if (user.role?.type !== STUDENT_ROLE) {
      throw new ForbiddenError('Solo los alumnos pueden solicitar el restablecimiento de contraseña');
    }
    const record = await getRecord(user.id);
    if (!record) return ctx.badRequest('El administrador debe dar de alta tu cuenta escolar');
    if (record.withdrawn) return ctx.forbidden('La cuenta está dada de baja');
    if (record.passwordResetRequested) {
      return ctx.badRequest('Ya enviaste una solicitud de restablecimiento');
    }
    await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: { passwordResetRequested: true },
    });
    ctx.body = { message: 'La solicitud se envió al administrador' };
  },

  async resetStudentPassword(ctx) {
    requireAdmin(ctx);
    const userId = Number(ctx.params.id);
    if (!Number.isInteger(userId) || userId < 1) return ctx.badRequest('Selecciona un alumno válido');
    const record = await getRecord(userId);
    if (!record) return ctx.notFound('No se encontró el expediente del alumno');
    const student = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: ['role'],
      select: ['id'],
    });
    if (!student || student.role?.type !== STUDENT_ROLE) return ctx.badRequest('La cuenta seleccionada no es un alumno');

    const temporaryPassword = String(crypto.randomInt(1_000_000, 10_000_000));
    await strapi.plugin('users-permissions').service('user').edit(userId, { password: temporaryPassword });
    await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: { passwordResetRequested: false },
    });
    ctx.body = { temporaryPassword };
  },

  async setEnrollmentAuthorization(ctx) {
    requireAdmin(ctx);
    const userId = Number(ctx.params.id);
    const { enabled } = ctx.request.body ?? {};
    if (!Number.isInteger(userId) || typeof enabled !== 'boolean') return ctx.badRequest('Solicitud no válida');
    const record = await getRecord(userId);
    if (!record) return ctx.badRequest('No se encontró el expediente del alumno');
    if (enabled) {
      if (record.withdrawn) {
        return ctx.badRequest('No se puede autorizar la inscripción: el alumno debe ser dado de baja');
      }
      const activeEnrollments = await strapi.db.query(ENROLLMENT_UID).count({
        where: {
          user: { id: userId },
          status: { $in: ['pending', 'enrolled'] },
        },
      });
      if (activeEnrollments > 0) {
        return ctx.badRequest('No se puede habilitar la inscripción hasta calificar y resolver todas las materias en curso');
      }
    }
    const updated = await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: { enrollmentEnabled: enabled },
    });
    ctx.body = { record: publicRecord(updated) };
  },

  async setStudentWithdrawal(ctx) {
    requireAdmin(ctx);
    const userId = Number(ctx.params.id);
    const { withdrawn } = ctx.request.body ?? {};
    if (!Number.isInteger(userId) || withdrawn !== true) return ctx.badRequest('Solicitud de baja no válida');

    const record = await getRecord(userId);
    if (!record) return ctx.badRequest('No se encontró el expediente del alumno');
    if (record.withdrawn) return ctx.badRequest('El alumno ya está dado de baja');
    if (!record.withdrawalEligible) {
      return ctx.badRequest('Solo se puede dar de baja al alumno después de reprobar una materia de segundo curso');
    }

    const updated = await strapi.db.query(RECORD_UID).update({
      where: { id: record.id, withdrawalEligible: true, withdrawn: false },
      data: { withdrawn: true, enrollmentEnabled: false },
    });
    if (!updated) return ctx.badRequest('No se pudo actualizar la baja del alumno');
    ctx.body = { record: publicRecord(updated) };
  },

  async findSubjects(ctx) {
    const user = requireUser(ctx);
    const record = user.role?.type === STUDENT_ROLE ? await getRecord(user.id) : null;
    const where = user.role?.type === STUDENT_ROLE
      ? { $or: [{ career: 'all' }, { career: record?.career ?? 'all' }] }
      : {};
    const subjects = await strapi.db.query(SUBJECT_UID).findMany({
      where,
      orderBy: { semester: 'asc', name: 'asc' },
    });
    ctx.body = { subjects: subjects.map(publicSubject) };
  },

  async createSubject(ctx) {
    requireAdmin(ctx);
    const { name, credits, semester, career } = ctx.request.body ?? {};
    const parsedCredits = Number(credits);
    const parsedSemester = Number(semester);
    const careerOptions = ['all', ...CAREERS];
    if (typeof name !== 'string' || !name.trim()) {
      return ctx.badRequest('El nombre de la materia es obligatorio');
    }
    if (!Number.isInteger(parsedCredits) || parsedCredits < 1) return ctx.badRequest('Los créditos deben ser un entero positivo');
    if (parsedCredits !== 5) return ctx.badRequest('Todas las materias de este plan valen 5 créditos');
    if (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 999) {
      return ctx.badRequest('El periodo debe ser un entero positivo');
    }
    if (!careerOptions.includes(career)) return ctx.badRequest('Selecciona una carrera válida');
    const normalizedName = name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (parsedSemester === 10 && career === 'ICO' && normalizedName !== 'practica profesional') {
      return ctx.badRequest('La única materia del décimo semestre es Práctica profesional');
    }

    let code = parsedSemester === 10 && career === 'ICO' && normalizedName === 'practica profesional' ? '999' : '';
    if (!code) {
      for (let number = 1; number <= 99; number += 1) {
        const candidate = `${parsedSemester}${String(number).padStart(2, '0')}`;
        const existing = await strapi.db.query(SUBJECT_UID).findOne({
          where: { code: candidate },
          select: ['id'],
        });
        if (!existing) {
          code = candidate;
          break;
        }
      }
    }
    if (!code) return ctx.badRequest('No hay más códigos de materia disponibles para este semestre');
    const existing = await strapi.db.query(SUBJECT_UID).findOne({ where: { code }, select: ['id'] });
    if (existing) return ctx.badRequest('Ese código de materia ya existe');
    const samePeriodCount = await strapi.db.query(SUBJECT_UID).count({ where: { semester: parsedSemester, career } });
    const isElective = parsedSemester === 8
      ? samePeriodCount >= 6
      : parsedSemester === 9
        ? samePeriodCount >= 3
        : false;
    const subject = await strapi.db.query(SUBJECT_UID).create({
      data: {
        name: name.trim(),
        code,
        credits: parsedCredits,
        semester: parsedSemester,
        career,
        isElective,
      },
    });
    if (parsedSemester === 1) {
      const firstSemesterRecords = await strapi.db.query(RECORD_UID).findMany({
        where: { semester: 1 },
        populate: { user: { select: ['id'] } },
      });
      for (const record of firstSemesterRecords) {
        if (record.user) await assignFirstSemesterSubjects(record.user.id, record, [subject]);
      }
    }
    ctx.body = { subject: publicSubject(subject) };
  },

  async findEnrollments(ctx) {
    const user = requireUser(ctx);
    const isAdmin = user.role?.type === ADMIN_ROLE;
    const isGradeCapturer = user.role?.type === GRADE_CAPTURER_ROLE;
    const enrollments = await strapi.db.query(ENROLLMENT_UID).findMany({
      where: isAdmin
        ? {}
        : isGradeCapturer
          ? { status: { $in: ['enrolled', 'passed', 'failed'] } }
          : { user: { id: user.id } },
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
      orderBy: { createdAt: 'desc' },
    });
    const records = await strapi.db.query(RECORD_UID).findMany({
      populate: { user: { select: ['id'] } },
      select: ['fullName', 'career', 'accountNumber'],
    });
    const recordsByUserId = new Map(
      records.map((record) => [record.user?.id, record])
    );
    ctx.body = {
      enrollments: enrollments.map((enrollment) => {
        const result = publicEnrollment(enrollment);
        if (isAdmin && !['passed', 'failed'].includes(enrollment.status)) {
          result.grade = null;
          result.ordinaryGrade = null;
          result.extraGrade = null;
          result.titleGrade = null;
        }
        if (!isGradeCapturer && !['passed', 'failed'].includes(enrollment.status)) {
          result.ordinaryGrade = null;
          result.extraGrade = null;
          result.titleGrade = null;
        }
        const record = recordsByUserId.get(enrollment.user?.id);
        if (result.student && record) {
          result.student = {
            ...result.student,
            fullName: record.fullName ?? '',
            career: record.career ?? '',
            accountNumber: record.accountNumber ?? '',
          };
        }
        return result;
      }),
    };
  },

  async findStudentsForGrades(ctx) {
    requireGradeAccess(ctx);
    const { career } = ctx.query;
    if (!CAREERS.includes(career)) return ctx.badRequest('Selecciona una carrera válida');

    const records = await strapi.db.query(RECORD_UID).findMany({
      where: { career },
      populate: { user: { select: ['id', 'username'] } },
      orderBy: { fullName: 'asc' },
    });
    const students = await Promise.all(records.filter((record) => record.user).map(async (record) => {
      const pendingGrades = await strapi.db.query(ENROLLMENT_UID).count({
        where: { user: { id: record.user.id }, status: 'enrolled' },
      });
      return {
        id: record.user.id,
        fullName: record.fullName,
        accountNumber: record.accountNumber,
        career: record.career,
        semester: record.semester,
        pendingGrades,
      };
    }));
    ctx.body = { students };
  },

  async findStudentEnrollmentsForGrades(ctx) {
    requireGradeAccess(ctx);
    const studentId = Number(ctx.params.studentId);
    if (!Number.isInteger(studentId) || studentId < 1) return ctx.badRequest('Selecciona un alumno válido');

    const record = await getRecord(studentId);
    if (!record) return ctx.notFound('No se encontró el expediente del alumno');
    const enrollments = await strapi.db.query(ENROLLMENT_UID).findMany({
      where: {
        user: { id: studentId },
        status: { $in: ['enrolled', 'passed', 'failed', 'withdrawn'] },
      },
      populate: { subject: true, user: { select: ['id', 'username'] } },
      orderBy: { createdAt: 'desc' },
    });
    ctx.body = {
      student: {
        id: studentId,
        fullName: record.fullName,
        accountNumber: record.accountNumber,
        career: record.career,
        semester: record.semester,
      },
      enrollments: enrollments.map((enrollment) => ({
        ...publicEnrollment(enrollment),
        student: {
          ...publicEnrollment(enrollment).student,
          fullName: record.fullName ?? '',
          career: record.career ?? '',
          accountNumber: record.accountNumber ?? '',
        },
      })),
    };
  },

  async requestEnrollment(ctx) {
    const user = requireUser(ctx);
    if (user.role?.type !== STUDENT_ROLE) throw new ForbiddenError('Solo el alumno puede solicitar materias');
    const record = await getRecord(user.id);
    if (!record?.enrollmentEnabled) return ctx.forbidden('El administrador aún no ha habilitado tu inscripción');
    if (record.withdrawn) {
      return ctx.forbidden('Tu cuenta no puede inscribirse; contacta al administrador');
    }
    const { subjectIds } = ctx.request.body ?? {};
    if (!Array.isArray(subjectIds) || !subjectIds.length || subjectIds.length > 7) {
      return ctx.badRequest('Selecciona de 1 a 7 materias');
    }
    const ids = [...new Set(subjectIds.map(Number))];
    if (ids.length !== subjectIds.length || ids.some((id) => !Number.isInteger(id) || id < 1)) {
      return ctx.badRequest('La selección de materias no es válida');
    }

    const [subjects, history] = await Promise.all([
      strapi.db.query(SUBJECT_UID).findMany({ where: { id: { $in: ids } } }),
      strapi.db.query(ENROLLMENT_UID).findMany({
        where: { user: { id: user.id } },
        populate: { subject: { select: ['id', 'semester', 'isElective'] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (subjects.length !== ids.length) return ctx.badRequest('Una o más materias ya no están disponibles');
    const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
    if (subjects.some((subject) => !['all', record.career].includes(subject.career ?? 'all'))) {
      return ctx.badRequest('Una o más materias no pertenecen a tu plan de estudios');
    }

    for (const id of ids) {
      const attempts = history.filter((item) => item.subject?.id === id && item.status !== 'withdrawn');
      if (attempts.some((item) => item.status === 'passed' || item.status === 'pending' || item.status === 'enrolled')) {
        return ctx.badRequest('No puedes volver a solicitar materias inscritas, pendientes o acreditadas');
      }
    }
    const requestBatch = crypto.randomUUID();
    const previousPeriod = history.reduce(
      (period, enrollment) => Math.max(period, enrollment.semester ?? 0),
      0
    );
    const period = previousPeriod
      ? previousPeriod + 1
      : Math.max(1, record.semester ?? 1);
    const enrollments = [];
    for (const id of ids) {
      const priorAttempts = history.filter((item) => item.subject?.id === id && item.status !== 'withdrawn').length;
      const subject = subjectsById.get(id);
      const wasCounted = history.some((item) =>
        item.subject?.id === id && item.countsTowardProgress !== false
      );
      const countsTowardProgress = !subject.isElective || wasCounted;
      enrollments.push(await strapi.db.query(ENROLLMENT_UID).create({
        data: {
          user: user.id,
          subject: id,
          status: 'pending',
          attempt: priorAttempts + 1,
          semester: period,
          requestBatch,
          advancesSemester: countsTowardProgress,
          countsTowardProgress,
          schedule: '',
        },
        populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
      }));
    }
    await strapi.db.query(RECORD_UID).update({
      where: { id: record.id },
      data: { semester: period, enrollmentEnabled: false, semesterBatch: requestBatch },
    });
    ctx.body = { enrollments: enrollments.map(publicEnrollment) };
  },

  async approveEnrollment(ctx) {
    requireAdmin(ctx);
    const enrollmentId = Number(ctx.params.id);
    const enrollment = await strapi.db.query(ENROLLMENT_UID).findOne({
      where: { id: enrollmentId },
      populate: { user: { select: ['id'] } },
    });
    if (!enrollment || enrollment.status !== 'pending') return ctx.badRequest('La solicitud ya no está pendiente');
    const record = enrollment.user?.id ? await getRecord(enrollment.user.id) : null;
    if (record?.withdrawn) {
      return ctx.badRequest('No se puede aceptar la inscripción de un alumno pendiente de baja');
    }
    const updated = await strapi.db.query(ENROLLMENT_UID).update({
      where: { id: enrollment.id, status: 'pending' },
      data: { status: 'enrolled' },
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
    });
    if (!updated) return ctx.badRequest('La solicitud ya no está pendiente');

    if (enrollment.requestBatch && enrollment.user?.id) {
      const record = await getRecord(enrollment.user.id);
      if (record?.semesterBatch === enrollment.requestBatch) {
        await strapi.db.query(RECORD_UID).update({
          where: { id: record.id, semesterBatch: enrollment.requestBatch },
          data: { semesterBatch: null, enrollmentEnabled: false },
        });
      }
    }
    ctx.body = { enrollment: publicEnrollment(updated) };
  },

  async requestCourseWithdrawal(ctx) {
    const user = requireUser(ctx);
    if (user.role?.type !== STUDENT_ROLE) {
      throw new ForbiddenError('Solo el alumno puede solicitar la baja de una materia');
    }
    const enrollmentId = Number(ctx.params.id);
    const { reason } = ctx.request.body ?? {};
    if (!Number.isInteger(enrollmentId) || enrollmentId < 1) return ctx.badRequest('Selecciona una materia válida');
    if (!['falta_de_tiempo', 'falta_de_conocimiento', 'otro'].includes(reason)) {
      return ctx.badRequest('Selecciona un motivo válido para la baja');
    }
    const enrollment = await strapi.db.query(ENROLLMENT_UID).findOne({
      where: { id: enrollmentId, user: { id: user.id } },
    });
    if (!enrollment || enrollment.status !== 'enrolled') {
      return ctx.badRequest('Solo puedes solicitar la baja de una materia que estés cursando');
    }
    if (enrollment.withdrawalRequested) return ctx.badRequest('La solicitud de baja ya está pendiente');
    if (
      enrollment.grade != null ||
      enrollment.ordinaryGrade != null ||
      enrollment.extraGrade != null ||
      enrollment.titleGrade != null
    ) {
      return ctx.badRequest('No puedes solicitar la baja después de que se registra una calificación');
    }
    const updated = await strapi.db.query(ENROLLMENT_UID).update({
      where: { id: enrollment.id, status: 'enrolled', withdrawalRequested: false },
      data: { withdrawalRequested: true, withdrawalReason: reason },
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
    });
    if (!updated) return ctx.badRequest('La solicitud de baja ya no está disponible');
    ctx.body = { enrollment: publicEnrollment(updated) };
  },

  async approveCourseWithdrawal(ctx) {
    requireAdmin(ctx);
    const enrollmentId = Number(ctx.params.id);
    if (!Number.isInteger(enrollmentId) || enrollmentId < 1) return ctx.badRequest('Selecciona una solicitud válida');
    const enrollment = await strapi.db.query(ENROLLMENT_UID).findOne({
      where: { id: enrollmentId, withdrawalRequested: true },
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
    });
    if (!enrollment || enrollment.status !== 'enrolled') return ctx.badRequest('La solicitud ya no está pendiente');
    if (
      enrollment.grade != null ||
      enrollment.ordinaryGrade != null ||
      enrollment.extraGrade != null ||
      enrollment.titleGrade != null
    ) {
      return ctx.badRequest('La materia ya tiene calificaciones y no puede darse de baja');
    }
    const updated = await strapi.db.query(ENROLLMENT_UID).update({
      where: { id: enrollment.id, status: 'enrolled', withdrawalRequested: true },
      data: { status: 'withdrawn', withdrawalRequested: false },
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
    });
    if (!updated) return ctx.badRequest('La solicitud ya no está pendiente');
    ctx.body = { enrollment: publicEnrollment(updated) };
  },

  async saveGrade(ctx) {
    requireGradeAccess(ctx);
    const enrollmentId = Number(ctx.params.enrollmentId);
    const studentId = Number(ctx.params.studentId);
    const { examType } = ctx.request.body ?? {};
    const grade = Number(typeof ctx.request.body?.grade === 'string'
      ? ctx.request.body.grade.replace(',', '.')
      : ctx.request.body?.grade);
    if (!Number.isInteger(studentId) || studentId < 1 || !Number.isInteger(enrollmentId) || !Number.isFinite(grade) || grade < 0 || grade > 10) {
      return ctx.badRequest('La calificación debe ser un número entre 0 y 10');
    }
    if (!['ordinary', 'extra', 'title'].includes(examType)) {
      return ctx.badRequest('Selecciona ordinario, extraordinario o título');
    }
    const enrollment = await strapi.db.query(ENROLLMENT_UID).findOne({
      where: { id: enrollmentId, user: { id: studentId } },
    });
    if (!enrollment || enrollment.status !== 'enrolled') return ctx.badRequest('Solo se puede calificar una materia inscrita');
    if (enrollment.withdrawalRequested) return ctx.badRequest('La materia tiene una solicitud de baja pendiente');

    const expectedExam = enrollment.ordinaryGrade == null
      ? 'ordinary'
      : enrollment.ordinaryGrade < 6 && enrollment.extraGrade == null
        ? 'extra'
        : enrollment.ordinaryGrade < 6 && enrollment.extraGrade < 6 && enrollment.titleGrade == null
          ? 'title'
          : null;
    if (examType !== expectedExam) {
      return ctx.badRequest(expectedExam
        ? `La siguiente calificación que corresponde es ${expectedExam}`
        : 'La materia ya tiene una calificación final');
    }
    const examField = {
      ordinary: 'ordinaryGrade',
      extra: 'extraGrade',
      title: 'titleGrade',
    }[examType];
    const data = { [examField]: grade };
    const isFinal = grade >= 6 || examType === 'title';
    if (isFinal) {
      data.grade = grade;
      data.status = grade >= 6 ? 'passed' : 'failed';
    }
    const updated = await strapi.db.query(ENROLLMENT_UID).update({
      where: { id: enrollment.id },
      data,
      populate: { subject: true, user: { select: ['id', 'username', 'email'] } },
    });
    ctx.body = { enrollment: publicEnrollment(updated) };
  },
};
