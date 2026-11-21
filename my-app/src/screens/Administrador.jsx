import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import {
  approveEnrollmentApi as aprobarInscripcionApi,
  approveCourseWithdrawalApi as aprobarBajaMateriaApi,
  createGradeCapturerApi as crearCuentaCapturistaApi,
  createStudentApi as crearCuentaAlumnoApi,
  createSubjectApi as crearMateriaApi,
  getEnrollmentsApi as obtenerInscripcionesApi,
  getGradeCapturersApi as obtenerCapturistasApi,
  getStudentsApi as obtenerAlumnosApi,
  getSubjectsApi as obtenerMateriasApi,
  resetStudentPasswordApi as restablecerContrasenaAlumnoApi,
  setEnrollmentAuthorizationApi as cambiarAutorizacionInscripcionApi,
  setStudentWithdrawalApi as darDeBajaAlumnoApi,
} from '../api/school';

const CUENTA_VACIA = { firstName: '', lastName: '', career: '' };
const CAPTURISTA_VACIO = { username: '', email: '', password: '' };
const MATERIA_VACIA = { name: '', credits: '5', semester: '1', career: 'all' };
const CARRERAS = ['ICO', 'ICI', 'ISES', 'IME', 'IEE', 'IA'];
const SEMESTRES = Array.from({ length: 10 }, (_, index) => String(index + 1));
const periodosConcluidos = (enrollments) => {
  const grouped = new Map();
  for (const enrollment of enrollments) {
    const period = enrollment.semester ?? enrollment.subject?.semester;
    if (!period) continue;
    grouped.set(period, [...(grouped.get(period) ?? []), enrollment]);
  }
  return [...grouped.entries()]
    .filter(([, items]) => items.length && items.every((item) => ['passed', 'failed', 'withdrawn'].includes(item.status)))
    .map(([period]) => period)
    .sort((a, b) => a - b);
};

const Administrador = ({ auth: autenticacion, logout: cerrarSesion }) => {
  const [seccion, setSeccion] = useState('alumnos');
  const [carreraSeleccionada, setCarreraSeleccionada] = useState('');
  const [carreraMaterias, setCarreraMaterias] = useState('');
  const [carreraBajas, setCarreraBajas] = useState('');
  const [busquedaMatricula, setBusquedaMatricula] = useState('');
  const [alumnoSeleccionadoId, setAlumnoSeleccionadoId] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(1);
  const [alumnos, setAlumnos] = useState([]);
  const [capturistas, setCapturistas] = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [cuenta, setCuenta] = useState(CUENTA_VACIA);
  const [credencialesCreadas, setCredencialesCreadas] = useState(null);
  const [credencialTemporal, setCredencialTemporal] = useState('');
  const [capturista, setCapturista] = useState(CAPTURISTA_VACIO);
  const [materia, setMateria] = useState(MATERIA_VACIA);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      const [resultadoAlumnos, resultadoInscripciones, resultadoMaterias, resultadoCapturistas] = await Promise.all([
        obtenerAlumnosApi(autenticacion.jwt),
        obtenerInscripcionesApi(autenticacion.jwt),
        obtenerMateriasApi(autenticacion.jwt),
        obtenerCapturistasApi(autenticacion.jwt),
      ]);
      setAlumnos(resultadoAlumnos.students);
      setInscripciones(resultadoInscripciones.enrollments);
      setMaterias(resultadoMaterias.subjects);
      setCapturistas(resultadoCapturistas.capturers);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [autenticacion.jwt]);

  const alumnoSeleccionado = alumnos.find((alumno) => alumno.id === alumnoSeleccionadoId);
  const inscripcionesAlumno = useMemo(
    () => inscripciones.filter((item) => item.student?.id === alumnoSeleccionadoId),
    [inscripciones, alumnoSeleccionadoId]
  );
  const alumnosCarrera = alumnos.filter((alumno) => alumno.record?.career === carreraSeleccionada);
  const alumnosFiltrados = alumnosCarrera.filter((alumno) =>
    `${alumno.record?.accountNumber ?? ''} ${alumno.username}`.toLowerCase().includes(busquedaMatricula.trim().toLowerCase())
  );
  const periodosAlumnoConcluidos = periodosConcluidos(inscripcionesAlumno);
  const periodoMostrado = periodosAlumnoConcluidos.includes(periodoSeleccionado)
    ? periodoSeleccionado
    : periodosAlumnoConcluidos[periodosAlumnoConcluidos.length - 1];
  const materiasDelPeriodoMostrado = inscripcionesAlumno.filter((item) =>
    (item.semester ?? item.subject?.semester) === periodoMostrado
  );

  const crearCuentaAlumno = async () => {
    setGuardando(true);
    setError('');
    setMensaje('');
    setCredencialesCreadas(null);
    try {
      const resultado = await crearCuentaAlumnoApi(autenticacion.jwt, cuenta);
      setCredencialesCreadas(resultado.student);
      setCuenta(CUENTA_VACIA);
      setMensaje('La cuenta de alumno fue creada. Guarda y comparte estas credenciales de forma segura.');
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const crearCuentaCapturista = async () => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await crearCuentaCapturistaApi(autenticacion.jwt, capturista);
      setCapturista(CAPTURISTA_VACIO);
      setMensaje('La cuenta de captura fue creada con acceso exclusivo a calificaciones.');
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarAutorizacion = async (alumno) => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await cambiarAutorizacionInscripcionApi(autenticacion.jwt, alumno.id, !alumno.record?.enrollmentEnabled);
      setMensaje(`Se actualizó el acceso de inscripción de ${alumno.record?.fullName || alumno.username}.`);
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const darDeBaja = async (alumno) => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await darDeBajaAlumnoApi(autenticacion.jwt, alumno.id);
      setMensaje(`${alumno.record?.fullName || alumno.username} quedó dado de baja. Su cuenta y expediente se conservaron.`);
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const aprobarSolicitud = async (inscripcionId) => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await aprobarInscripcionApi(autenticacion.jwt, inscripcionId);
      setMensaje('La solicitud fue aceptada y la materia ya aparece como inscrita.');
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const aprobarBajaMateria = async (inscripcionId) => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await aprobarBajaMateriaApi(autenticacion.jwt, inscripcionId);
      setMensaje('La baja de la materia fue aprobada.');
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const restablecerContrasena = async (alumno) => {
    setGuardando(true);
    setError('');
    setMensaje('');
    setCredencialTemporal('');
    try {
      const resultado = await restablecerContrasenaAlumnoApi(autenticacion.jwt, alumno.id);
      setCredencialTemporal(resultado.temporaryPassword);
      setMensaje(`Contraseña restablecida para ${alumno.record?.fullName || alumno.username}.`);
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  const agregarMateria = async () => {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await crearMateriaApi(autenticacion.jwt, materia);
      setMateria(MATERIA_VACIA);
      setMensaje(`La materia se agregó al plan de estudios con el código ${resultado.subject.code}.`);
      await cargarDatos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="bodySmall" style={styles.eyebrow}>ADMINISTRACIÓN ESCOLAR</Text>
      <Text variant="headlineSmall" style={styles.title}>Panel del administrador</Text>
      <Text variant="bodyMedium" style={styles.description}>
        Consulta expedientes y gestiona alumnos, inscripciones y planes de estudio.
      </Text>

      <View style={styles.navigation}>
        <BotonSeccion seleccionado={seccion === 'alumnos'} onPress={() => setSeccion('alumnos')}>Alumnos</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'alta'} onPress={() => setSeccion('alta')}>Alta de alumnos</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'inscripciones'} onPress={() => setSeccion('inscripciones')}>Inscripciones</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'bajas'} onPress={() => setSeccion('bajas')}>Solicitudes de bajas</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'materias'} onPress={() => setSeccion('materias')}>Materias</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'capturistas'} onPress={() => setSeccion('capturistas')}>Capturistas</BotonSeccion>
      </View>

      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <HelperText type="info" visible={Boolean(mensaje)}>{mensaje}</HelperText>
      {credencialTemporal ? (
        <Card style={styles.credentialsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.credentialsTitle}>Contraseña temporal</Text>
            <Text variant="bodyLarge" style={styles.credential}>{credencialTemporal}</Text>
            <Text variant="bodySmall" style={styles.description}>Compártela de forma segura con el alumno.</Text>
          </Card.Content>
        </Card>
      ) : null}

      {cargando ? (
        <Text style={styles.description}>Cargando información escolar...</Text>
      ) : (
        <>
          {seccion === 'alumnos' && (
            <>
              {alumnoSeleccionado ? (
                <>
                  <Button
                    icon="arrow-left"
                    mode="text"
                    onPress={() => setAlumnoSeleccionadoId(null)}
                    style={styles.backButton}
                  >
                    Regresar a {carreraSeleccionada}
                  </Button>
                  <Text variant="titleLarge" style={styles.heading}>
                    {alumnoSeleccionado.record?.fullName || alumnoSeleccionado.username}
                  </Text>
                  <Card style={styles.formCard}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.subheading}>Datos personales</Text>
                      <Dato label="Nombre" value={alumnoSeleccionado.record?.firstName} />
                      <Dato label="Apellidos" value={alumnoSeleccionado.record?.lastName} />
                      <Dato label="Número de cuenta" value={alumnoSeleccionado.record?.accountNumber} />
                      <Dato label="Carrera" value={alumnoSeleccionado.record?.career} />
                      <Dato label="Correo" value={alumnoSeleccionado.record?.contactEmail || alumnoSeleccionado.email} />
                      <Dato label="Teléfono" value={alumnoSeleccionado.record?.contactPhone} />
                      <Dato label="Dirección" value={alumnoSeleccionado.record?.address} />
                      <Dato label="Padres o tutores" value={alumnoSeleccionado.record?.parentNames} />
                      <Dato label="Tipo de sangre" value={alumnoSeleccionado.record?.bloodType} />
                      <Dato label="Código postal" value={alumnoSeleccionado.record?.postalCode} />
                      <Dato label="Situación académica" value={`Periodo ${alumnoSeleccionado.record?.semester ?? 1}${alumnoSeleccionado.record?.withdrawn ? ' · Baja definitiva' : ''}`} />
                      <Dato label="Solicitud de restablecimiento" value={alumnoSeleccionado.record?.passwordResetRequested ? 'Pendiente' : 'Sin solicitud pendiente'} />
                      <Button
                        mode="outlined"
                        icon="lock-reset"
                        onPress={() => restablecerContrasena(alumnoSeleccionado)}
                        loading={guardando}
                        disabled={guardando}
                        style={styles.action}
                      >
                        Restablecer contraseña
                      </Button>
                    </Card.Content>
                  </Card>
                  <Text variant="titleLarge" style={styles.heading}>Trayectoria académica</Text>
                  <View style={styles.options}>
                    {periodosAlumnoConcluidos.map((periodo) => (
                      <BotonSeccion
                        key={periodo}
                        seleccionado={periodoMostrado === Number(periodo)}
                        onPress={() => setPeriodoSeleccionado(Number(periodo))}
                      >
                        Periodo {periodo}
                      </BotonSeccion>
                    ))}
                  </View>
                  <Card style={styles.formCard}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.subheading}>Periodo {periodoMostrado ?? 'sin concluir'}</Text>
                      {materiasDelPeriodoMostrado.filter((item) => item.status !== 'withdrawn').length ? materiasDelPeriodoMostrado.filter((item) => item.status !== 'withdrawn').map((item) => (
                        <View key={item.id} style={styles.historyRow}>
                          <Text variant="bodyMedium" style={styles.studentName}>
                            {item.subject?.code} · {item.subject?.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.description}>
                            {estadoInscripcion(item.status)}
                            {item.grade !== null ? ` · Calificación: ${item.grade}` : ''}
                            {item.ordinaryGrade !== null ? ` · Ordinario: ${item.ordinaryGrade}` : ''}
                            {item.extraGrade !== null ? ` · Extra: ${item.extraGrade}` : ''}
                            {item.titleGrade !== null ? ` · Título: ${item.titleGrade}` : ''}
                            {item.attempt > 1 ? ' · Segundo curso' : ''}
                          </Text>
                        </View>
                      )) : <Text style={styles.description}>Este alumno aún no tiene periodos concluidos.</Text>}
                    </Card.Content>
                  </Card>
                </>
              ) : carreraSeleccionada ? (
                <>
                  <Button
                    icon="arrow-left"
                    mode="text"
                    onPress={() => {
                      setCarreraSeleccionada('');
                      setBusquedaMatricula('');
                    }}
                    style={styles.backButton}
                  >
                    Todas las carreras
                  </Button>
                  <Text variant="titleLarge" style={styles.heading}>Alumnos de {carreraSeleccionada}</Text>
                  <TextInput
                    label="Buscar por matrícula"
                    value={busquedaMatricula}
                    onChangeText={setBusquedaMatricula}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  {alumnosFiltrados.length ? alumnosFiltrados.map((alumno) => {
                    const requiereResolucion = inscripciones.some((item) =>
                      item.student?.id === alumno.id && ['pending', 'enrolled'].includes(item.status)
                    );
                    const puedeDarseDeBaja = alumno.record?.withdrawalEligible && !alumno.record?.withdrawn;
                    return (
                      <Card key={alumno.id} style={styles.studentCard}>
                        <Card.Content>
                          <Text variant="titleMedium" style={styles.studentName}>
                            {alumno.record?.fullName || alumno.username}
                          </Text>
                          <Text variant="bodySmall" style={styles.description}>
                            Cuenta: {alumno.record?.accountNumber || alumno.username} · Periodo {alumno.record?.semester ?? 1}
                          </Text>
                          <Button mode="contained" onPress={() => {
                            setAlumnoSeleccionadoId(alumno.id);
                            setPeriodoSeleccionado(alumno.record?.semester ?? 1);
                            setCredencialTemporal('');
                          }} style={styles.action}>
                            Ver expediente y trayectoria
                          </Button>
                          {puedeDarseDeBaja ? (
                            <Button mode="outlined" disabled={guardando} onPress={() => darDeBaja(alumno)} style={styles.action}>
                              Dar de baja
                            </Button>
                          ) : (
                            <Button
                              mode={alumno.record?.enrollmentEnabled ? 'outlined' : 'contained'}
                              disabled={guardando || !alumno.record || alumno.record.withdrawn || (!alumno.record.enrollmentEnabled && requiereResolucion)}
                              onPress={() => cambiarAutorizacion(alumno)}
                              style={styles.action}
                            >
                              {alumno.record?.withdrawn
                                ? 'Alumno dado de baja'
                                : alumno.record?.enrollmentEnabled
                                  ? 'Bloquear inscripción'
                                  : requiereResolucion
                                    ? 'Resolver materias primero'
                                    : 'Autorizar inscripción'}
                            </Button>
                          )}
                        </Card.Content>
                      </Card>
                    );
                  }) : <Text style={styles.description}>{alumnosCarrera.length ? 'No se encontraron alumnos con esa matrícula.' : 'No hay alumnos registrados en esta carrera.'}</Text>}
                </>
              ) : (
                <>
                  <Text variant="titleLarge" style={styles.heading}>Selecciona una carrera</Text>
                  <View style={styles.options}>
                    {CARRERAS.map((carrera) => (
                      <Button
                        key={carrera}
                        mode="outlined"
                        onPress={() => setCarreraSeleccionada(carrera)}
                        style={styles.botonCarrera}
                      >
                        {carrera} · {alumnos.filter((alumno) => alumno.record?.career === carrera).length}
                      </Button>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {seccion === 'alta' && (
            <>
              <Text variant="titleLarge" style={styles.heading}>Alta de alumnos</Text>
              <Card style={styles.formCard}>
                <Card.Content>
                  <TextInput label="Nombre" value={cuenta.firstName} onChangeText={(value) => setCuenta({ ...cuenta, firstName: value })} style={styles.input} />
                  <TextInput label="Apellidos" value={cuenta.lastName} onChangeText={(value) => setCuenta({ ...cuenta, lastName: value })} style={styles.input} />
                  <Text variant="bodyMedium" style={styles.etiquetaCarrera}>Carrera</Text>
                  <View style={styles.options}>
                    {CARRERAS.map((carrera) => (
                      <BotonSeccion key={carrera} seleccionado={cuenta.career === carrera} onPress={() => setCuenta({ ...cuenta, career: carrera })}>
                        {carrera}
                      </BotonSeccion>
                    ))}
                  </View>
                  <Button
                    mode="contained"
                    onPress={crearCuentaAlumno}
                    loading={guardando}
                    disabled={guardando || !cuenta.firstName.trim() || !cuenta.lastName.trim() || !cuenta.career}
                    style={styles.action}
                  >
                    Crear cuenta de alumno
                  </Button>
                  {credencialesCreadas && (
                    <Card style={styles.credentialsCard}>
                      <Card.Content>
                        <Text variant="titleMedium" style={styles.credentialsTitle}>Credenciales iniciales</Text>
                        <Text variant="bodyMedium" style={styles.description}>
                          {credencialesCreadas.fullName} · {credencialesCreadas.career}
                        </Text>
                        <Text variant="bodyLarge" style={styles.credential}>
                          Cuenta y contraseña inicial: {credencialesCreadas.accountNumber}
                        </Text>
                      </Card.Content>
                    </Card>
                  )}
                </Card.Content>
              </Card>
            </>
          )}

          {seccion === 'inscripciones' && (
            <>
              <Text variant="titleLarge" style={styles.heading}>Solicitudes de inscripción</Text>
              {inscripciones.filter((item) => item.status === 'pending').length ? (
                inscripciones.filter((item) => item.status === 'pending').map((item) => (
                  <Card key={item.id} style={styles.studentCard}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.studentName}>{item.subject?.name}</Text>
                      <Text variant="bodyMedium" style={styles.description}>
                        {item.student?.fullName || item.student?.username} · {item.subject?.code}
                      </Text>
                      <Text variant="bodySmall" style={styles.description}>
                        Periodo {item.semester ?? item.subject?.semester}
                      </Text>
                      <Button mode="contained" onPress={() => aprobarSolicitud(item.id)} loading={guardando} disabled={guardando} style={styles.action}>
                        Aceptar solicitud
                      </Button>
                    </Card.Content>
                  </Card>
                ))
              ) : <Text style={styles.description}>No hay solicitudes pendientes.</Text>}
            </>
          )}

          {seccion === 'bajas' && (
            <>
              <Text variant="titleLarge" style={styles.heading}>Solicitudes de baja de materias</Text>
              {!carreraBajas ? (
                <View style={styles.options}>
                  {CARRERAS.map((carrera) => (
                    <Button key={carrera} mode="outlined" onPress={() => setCarreraBajas(carrera)} style={styles.botonCarrera}>
                      {carrera} · {inscripciones.filter((item) => item.withdrawalRequested && item.student?.career === carrera).length}
                    </Button>
                  ))}
                </View>
              ) : (
                <>
                  <Button mode="text" icon="arrow-left" onPress={() => setCarreraBajas('')} style={styles.backButton}>
                    Todas las carreras
                  </Button>
                  <Text variant="titleMedium" style={styles.subheading}>Solicitudes de {carreraBajas}</Text>
                  {inscripciones.filter((item) => item.withdrawalRequested && item.student?.career === carreraBajas).length ? (
                    inscripciones.filter((item) => item.withdrawalRequested && item.student?.career === carreraBajas).map((item) => (
                      <Card key={item.id} style={styles.studentCard}>
                        <Card.Content>
                          <Text variant="titleMedium" style={styles.studentName}>
                            {item.subject?.code} · {item.subject?.name}
                          </Text>
                          <Text variant="bodyMedium" style={styles.description}>
                            Alumno: {item.student?.fullName || item.student?.username} · Matrícula: {item.student?.accountNumber}
                          </Text>
                          <Text variant="bodySmall" style={styles.description}>
                            Motivo: {motivoBaja(item.withdrawalReason)}
                          </Text>
                          <Button mode="contained" onPress={() => aprobarBajaMateria(item.id)} loading={guardando} disabled={guardando} style={styles.action}>
                            Aprobar baja
                          </Button>
                        </Card.Content>
                      </Card>
                    ))
                  ) : <Text style={styles.description}>No hay solicitudes pendientes en esta carrera.</Text>}
                </>
              )}
            </>
          )}

          {seccion === 'materias' && (
            <>
              <Text variant="titleLarge" style={styles.heading}>Plan de estudios</Text>
              {!carreraMaterias ? (
                <>
                  <Text variant="titleMedium" style={styles.subheading}>Selecciona la carrera</Text>
                  <View style={styles.options}>
                    <Button mode="outlined" onPress={() => {
                      setCarreraMaterias('all');
                      setMateria({ ...MATERIA_VACIA, career: 'all' });
                    }} style={styles.botonCarrera}>Todas las carreras</Button>
                    {CARRERAS.map((carrera) => (
                      <Button key={carrera} mode="outlined" onPress={() => {
                        setCarreraMaterias(carrera);
                        setMateria({ ...MATERIA_VACIA, career: carrera });
                      }} style={styles.botonCarrera}>{carrera}</Button>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Button mode="text" icon="arrow-left" onPress={() => setCarreraMaterias('')} style={styles.backButton}>
                    Cambiar carrera
                  </Button>
                  <Text variant="titleMedium" style={styles.subheading}>
                    Materias de {carreraMaterias === 'all' ? 'todas las carreras' : carreraMaterias}
                  </Text>
              <Card style={styles.formCard}>
                <Card.Content>
                  <TextInput label="Nombre de la materia" value={materia.name} onChangeText={(value) => setMateria({ ...materia, name: value })} style={styles.input} />
                  <Text variant="bodyMedium" style={styles.etiquetaCarrera}>Periodo</Text>
                  <View style={styles.options}>
                    {SEMESTRES.map((periodo) => (
                      <BotonSeccion key={periodo} seleccionado={materia.semester === periodo} onPress={() => setMateria({
                        ...materia,
                        semester: periodo,
                        career: carreraMaterias,
                      })}>
                        {periodo}
                      </BotonSeccion>
                    ))}
                  </View>
                  <TextInput label="Créditos" value={materia.credits} editable={false} style={styles.input} />
                  <Button mode="contained" onPress={agregarMateria} loading={guardando} disabled={guardando || !materia.name.trim()} style={styles.action}>
                    Agregar materia
                  </Button>
                </Card.Content>
              </Card>
              {materias.filter((item) => carreraMaterias === 'all'
                ? item.career === 'all'
                : item.career === 'all' || item.career === carreraMaterias).map((item) => (
                <Card key={item.id} style={styles.studentCard}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.studentName}>{item.name}</Text>
                    <Text variant="bodySmall" style={styles.description}>
                      {item.code} · Periodo {item.semester} · {item.credits} créditos{item.isElective ? ' · Optativa' : ''}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
                </>
              )}
            </>
          )}

          {seccion === 'capturistas' && (
            <>
              <Text variant="titleLarge" style={styles.heading}>Cuentas de capturista</Text>
              <Card style={styles.formCard}>
                <Card.Content>
                  <TextInput label="Nombre de usuario" value={capturista.username} onChangeText={(value) => setCapturista({ ...capturista, username: value })} autoCapitalize="none" style={styles.input} />
                  <TextInput label="Correo electrónico" value={capturista.email} onChangeText={(value) => setCapturista({ ...capturista, email: value })} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                  <TextInput label="Contraseña temporal (mínimo 6 caracteres)" value={capturista.password} onChangeText={(value) => setCapturista({ ...capturista, password: value })} secureTextEntry style={styles.input} />
                  <Button mode="contained" onPress={crearCuentaCapturista} loading={guardando} disabled={guardando || !capturista.username.trim() || !capturista.email.trim() || capturista.password.length < 6} style={styles.action}>
                    Crear cuenta de capturista
                  </Button>
                </Card.Content>
              </Card>
              {capturistas.map((item) => (
                <Card key={item.id} style={styles.studentCard}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.studentName}>{item.username}</Text>
                    <Text variant="bodySmall" style={styles.description}>{item.email} · Acceso exclusivo a calificaciones</Text>
                  </Card.Content>
                </Card>
              ))}
            </>
          )}
        </>
      )}
      <Button mode="outlined" icon="logout" onPress={cerrarSesion} style={styles.logout}>Cerrar sesión</Button>
    </ScrollView>
  );
};

const Dato = ({ label, value }) => (
  <Text variant="bodyMedium" style={styles.dataRow}>{label}: {value || 'Sin registrar'}</Text>
);

const estadoInscripcion = (status) => ({
  pending: 'Pendiente de aprobación',
  enrolled: 'Inscrita · En curso',
  passed: 'Acreditada',
  failed: 'No acreditada · Recursar',
}[status] ?? status);

const motivoBaja = (reason) => ({
  falta_de_tiempo: 'Falta de tiempo',
  falta_de_conocimiento: 'Falta de conocimiento',
  otro: 'Otro',
}[reason] ?? 'No especificado');

const BotonSeccion = ({ seleccionado, onPress, children }) => (
  <Button mode={seleccionado ? 'contained' : 'outlined'} compact onPress={onPress} style={styles.botonSeccion}>
    {children}
  </Button>
);

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 32, paddingBottom: 36, backgroundColor: '#f4f7fb' },
  eyebrow: { color: '#176b87', fontWeight: '700', letterSpacing: 1 },
  title: { color: '#1d2d44', fontWeight: '700', marginTop: 8 },
  description: { color: '#69788b', marginTop: 4, lineHeight: 21 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, marginBottom: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  botonSeccion: { marginRight: 6, marginBottom: 6 },
  botonCarrera: { marginRight: 8, marginBottom: 8 },
  backButton: { alignSelf: 'flex-start', marginTop: 8 },
  heading: { color: '#1d2d44', fontWeight: '700', marginTop: 12, marginBottom: 12 },
  subheading: { color: '#1d2d44', fontWeight: '700', marginTop: 4, marginBottom: 8 },
  etiquetaCarrera: { color: '#69788b', marginTop: 18 },
  formCard: { borderRadius: 16, marginBottom: 14, backgroundColor: '#fff' },
  input: { marginTop: 12, backgroundColor: '#fff' },
  action: { marginTop: 12 },
  studentCard: { borderRadius: 14, marginBottom: 10, backgroundColor: '#fff' },
  studentName: { color: '#1d2d44', fontWeight: '600' },
  dataRow: { color: '#35465d', paddingVertical: 5 },
  historyRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dce4ec' },
  credentialsCard: { borderRadius: 12, marginTop: 12, marginBottom: 10, backgroundColor: '#f0f8ff' },
  credentialsTitle: { color: '#176b87', fontWeight: '700' },
  credential: { color: '#1d2d44', fontWeight: '700', marginTop: 8 },
  logout: { marginTop: 24, borderColor: '#cbd5e1' },
});

export default Administrador;
