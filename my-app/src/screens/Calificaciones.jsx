import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import {
  getStudentEnrollmentsForGradesApi,
  getStudentsForGradesApi,
  saveGradeApi,
} from '../api/school';

const CARRERAS = ['ICO', 'ICI', 'ISES', 'IME', 'IEE', 'IA'];

const Calificaciones = ({ auth: autenticacion, logout: cerrarSesion }) => {
  const [carrera, setCarrera] = useState('');
  const [alumnos, setAlumnos] = useState([]);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [inscripciones, setInscripciones] = useState([]);
  const [calificaciones, setCalificaciones] = useState({});
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [cargandoInscripciones, setCargandoInscripciones] = useState(false);
  const [idGuardando, setIdGuardando] = useState(null);

  const seleccionarCarrera = async (carreraSeleccionada) => {
    setCarrera(carreraSeleccionada);
    setAlumnoSeleccionado(null);
    setInscripciones([]);
    setCalificaciones({});
    setCargandoAlumnos(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await getStudentsForGradesApi(autenticacion.jwt, carreraSeleccionada);
      setAlumnos(resultado.students);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
      setAlumnos([]);
    } finally {
      setCargandoAlumnos(false);
    }
  };

  const seleccionarAlumno = async (alumno) => {
    setAlumnoSeleccionado(alumno);
    setCargandoInscripciones(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await getStudentEnrollmentsForGradesApi(autenticacion.jwt, alumno.id);
      setAlumnoSeleccionado(resultado.student);
      setInscripciones(resultado.enrollments);
      setPeriodoSeleccionado(
        resultado.enrollments.reduce((latest, item) => Math.max(latest, item.semester ?? 0), 0)
      );
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
      setInscripciones([]);
    } finally {
      setCargandoInscripciones(false);
    }
  };

  useEffect(() => {
    setAlumnos([]);
    setInscripciones([]);
    setAlumnoSeleccionado(null);
    setCarrera('');
  }, [autenticacion.jwt]);

  const guardarCalificacion = async (inscripcionId) => {
    if (!alumnoSeleccionado) return;
    setIdGuardando(inscripcionId);
    setError('');
    setMensaje('');
    try {
      await saveGradeApi(
        autenticacion.jwt,
        alumnoSeleccionado.id,
        inscripcionId,
        siguienteExamen(inscripciones.find((item) => item.id === inscripcionId)),
        calificaciones[inscripcionId]
      );
      setCalificaciones((actuales) => ({ ...actuales, [inscripcionId]: '' }));
      await seleccionarAlumno(alumnoSeleccionado);
      setMensaje('La calificación quedó guardada.');
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setIdGuardando(null);
    }
  };

  const volverAAlumnos = () => {
    setAlumnoSeleccionado(null);
    setInscripciones([]);
    setCalificaciones({});
    setError('');
  };

  const periodosAlumno = [...new Set(inscripciones.map((item) => item.semester ?? item.subject?.semester))]
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  const calificacionesPendientes = inscripciones.filter((item) =>
    (item.semester ?? item.subject?.semester) === periodoSeleccionado && item.status === 'enrolled'
  );
  const calificacionesRegistradas = inscripciones.filter((item) =>
    (item.semester ?? item.subject?.semester) === periodoSeleccionado && ['passed', 'failed', 'withdrawn'].includes(item.status)
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="bodySmall" style={styles.eyebrow}>CAPTURA ESCOLAR</Text>
      <Text variant="headlineSmall" style={styles.title}>Calificaciones</Text>
      <Text variant="bodyMedium" style={styles.description}>
        Selecciona una carrera y un alumno para consultar sus materias inscritas y capturar sus calificaciones.
      </Text>

      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <HelperText type="info" visible={Boolean(mensaje)}>{mensaje}</HelperText>

      {!alumnoSeleccionado ? (
        <>
          <Text variant="titleLarge" style={styles.heading}>Seleccionar carrera</Text>
          <View style={styles.carreras}>
            {CARRERAS.map((opcionCarrera) => (
              <Button
                key={opcionCarrera}
                mode={carrera === opcionCarrera ? 'contained' : 'outlined'}
                onPress={() => seleccionarCarrera(opcionCarrera)}
                style={styles.botonCarrera}
              >
                {opcionCarrera}
              </Button>
            ))}
          </View>

          {cargandoAlumnos ? (
            <Text style={styles.description}>Cargando alumnos...</Text>
          ) : carrera ? (
            <>
              <Text variant="titleLarge" style={styles.heading}>Alumnos de {carrera}</Text>
              {alumnos.length ? alumnos.map((alumno) => (
                <Card key={alumno.id} style={styles.card}>
                  <Card.Content style={styles.filaAlumno}>
                    <View style={styles.datosAlumno}>
                      <Text variant="titleMedium" style={styles.nombreAlumno}>{alumno.fullName || 'Sin nombre'}</Text>
                      <Text variant="bodySmall" style={styles.description}>
                        Cuenta {alumno.accountNumber} · Periodo {alumno.semester}
                      </Text>
                      <Text variant="bodySmall" style={styles.pendientes}>
                        Materias pendientes de calificar: {alumno.pendingGrades}
                      </Text>
                    </View>
                    <Button mode="contained" compact onPress={() => seleccionarAlumno(alumno)}>
                      Abrir
                    </Button>
                  </Card.Content>
                </Card>
              )) : (
                <Text style={styles.description}>No hay alumnos registrados en esta carrera.</Text>
              )}
            </>
          ) : (
            <Text style={styles.description}>Elige una carrera para consultar sus alumnos.</Text>
          )}
        </>
      ) : (
        <>
          <Button mode="text" icon="arrow-left" onPress={volverAAlumnos} style={styles.volver}>
            Volver a alumnos de {carrera}
          </Button>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.nombreAlumno}>
                {alumnoSeleccionado.fullName || 'Sin nombre'}
              </Text>
              <Text variant="bodyMedium" style={styles.description}>
                Carrera {alumnoSeleccionado.career} · Cuenta {alumnoSeleccionado.accountNumber} · Periodo {alumnoSeleccionado.semester}
              </Text>
            </Card.Content>
          </Card>

          {cargandoInscripciones ? (
            <Text style={styles.description}>Cargando materias del alumno...</Text>
          ) : (
            <>
              <Text variant="titleLarge" style={styles.heading}>Periodos de inscripción</Text>
              <View style={styles.carreras}>
                {periodosAlumno.map((periodo) => (
                  <Button
                    key={periodo}
                    mode={periodoSeleccionado === periodo ? 'contained' : 'outlined'}
                    onPress={() => setPeriodoSeleccionado(periodo)}
                    style={styles.botonCarrera}
                  >
                    Periodo {periodo}
                  </Button>
                ))}
              </View>
              <Text variant="titleLarge" style={styles.heading}>Periodo {periodoSeleccionado}</Text>
              {calificacionesPendientes.length ? calificacionesPendientes.map((item) => (
                <Card key={item.id} style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.nombreAlumno}>
                      {item.subject?.code} · {item.subject?.name}
                    </Text>
                    <Text variant="bodyMedium" style={styles.description}>
                      {item.attempt > 1 ? 'Recursamiento' : 'Primera inscripción'}
                    </Text>
                    <Text variant="bodySmall" style={styles.description}>
                      Ordinario: {item.ordinaryGrade ?? '—'}
                      {item.extraGrade !== null ? ` · Extra: ${item.extraGrade}` : ''}
                      {item.titleGrade !== null ? ` · Título: ${item.titleGrade}` : ''}
                    </Text>
                    <TextInput
                      label={`Calificación de ${nombreExamen(siguienteExamen(item))} (0 a 10)`}
                      value={calificaciones[item.id] ?? ''}
                      onChangeText={(valor) => setCalificaciones((actuales) => ({ ...actuales, [item.id]: valor }))}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                    <Button
                      mode="contained"
                      onPress={() => guardarCalificacion(item.id)}
                      loading={idGuardando === item.id}
                      disabled={idGuardando !== null || calificaciones[item.id] === undefined || calificaciones[item.id] === ''}
                      style={styles.action}
                    >
                      Guardar {nombreExamen(siguienteExamen(item))}
                    </Button>
                  </Card.Content>
                </Card>
              )) : (
                <Text style={styles.description}>No hay materias pendientes de calificación en este periodo.</Text>
              )}

              <Text variant="titleLarge" style={styles.heading}>Calificaciones asentadas</Text>
              {calificacionesRegistradas.length ? calificacionesRegistradas.filter((item) => item.status !== 'withdrawn').map((item) => (
                <Card key={item.id} style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.nombreAlumno}>
                      {item.subject?.code} · {item.subject?.name}
                    </Text>
                    <Text variant="bodyMedium" style={styles.calificacion}>
                      Ordinario: {item.ordinaryGrade ?? '—'}
                      {item.extraGrade !== null ? ` · Extra: ${item.extraGrade}` : ''}
                      {item.titleGrade !== null ? ` · Título: ${item.titleGrade}` : ''}
                      {' · '}{item.status === 'passed' ? 'Acreditada' : 'No acreditada'} ({item.grade})
                    </Text>
                  </Card.Content>
                </Card>
              )) : (
                <Text style={styles.description}>Aún no hay calificaciones asentadas.</Text>
              )}
            </>
          )}
        </>
      )}

      <Button mode="outlined" icon="logout" onPress={cerrarSesion} style={styles.cerrarSesion}>
        Cerrar sesión
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 32,
    paddingBottom: 36,
    backgroundColor: '#f4f7fb',
  },
  eyebrow: { color: '#176b87', fontWeight: '700', letterSpacing: 1 },
  title: { color: '#1d2d44', fontWeight: '700', marginTop: 8 },
  description: { color: '#69788b', marginTop: 4, lineHeight: 21 },
  heading: { color: '#1d2d44', fontWeight: '700', marginTop: 20, marginBottom: 12 },
  carreras: { flexDirection: 'row', flexWrap: 'wrap' },
  botonCarrera: { marginRight: 8, marginBottom: 8 },
  card: { borderRadius: 14, marginBottom: 10, backgroundColor: '#fff' },
  filaAlumno: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datosAlumno: { flex: 1, marginRight: 10 },
  nombreAlumno: { color: '#1d2d44', fontWeight: '700' },
  pendientes: { color: '#176b87', marginTop: 6 },
  volver: { alignSelf: 'flex-start', marginTop: 8 },
  input: { marginTop: 12, backgroundColor: '#fff' },
  action: { marginTop: 12 },
  calificacion: { color: '#176b87', fontWeight: '700', marginTop: 8 },
  cerrarSesion: { marginTop: 24, borderColor: '#cbd5e1' },
});

const siguienteExamen = (item) => {
  if (!item || item.ordinaryGrade == null) return 'ordinary';
  if (item.ordinaryGrade < 6 && item.extraGrade == null) return 'extra';
  if (item.ordinaryGrade < 6 && item.extraGrade < 6 && item.titleGrade == null) return 'title';
  return null;
};

const nombreExamen = (exam) => ({
  ordinary: 'ordinario',
  extra: 'extraordinario',
  title: 'título',
}[exam] ?? 'calificación');

export default Calificaciones;
