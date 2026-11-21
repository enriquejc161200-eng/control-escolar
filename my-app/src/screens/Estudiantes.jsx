import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, HelperText, Menu, Text, TextInput } from 'react-native-paper';
import {
  changePasswordApi as cambiarContrasenaApi,
  getEnrollmentsApi as obtenerInscripcionesApi,
  getSubjectsApi as obtenerMateriasApi,
  requestCourseWithdrawalApi as solicitarBajaMateriaApi,
  requestEnrollmentApi as solicitarInscripcionApi,
  requestPasswordResetApi as solicitarRestablecimientoApi,
  updateProfileApi as actualizarPerfilApi,
} from '../api/school';

const PERFIL_VACIO = {
  firstName: '',
  lastName: '',
  address: '',
  contactPhone: '',
  contactEmail: '',
  parentNames: '',
  bloodType: '',
  postalCode: '',
};
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MOTIVOS_BAJA = [
  { value: 'falta_de_tiempo', label: 'Falta de tiempo' },
  { value: 'falta_de_conocimiento', label: 'Falta de conocimiento' },
  { value: 'otro', label: 'Otro' },
];
const CONTRASENAS_VACIAS = { currentPassword: '', newPassword: '', confirmPassword: '' };

const Estudiantes = ({ schoolInfo: informacionEscolar, logout: cerrarSesion, auth: autenticacion }) => {
  const { user: usuario } = informacionEscolar;
  const [expediente, setExpediente] = useState(informacionEscolar.record);
  const [perfil, setPerfil] = useState({ ...PERFIL_VACIO, ...informacionEscolar.record });
  const [seccion, setSeccion] = useState('inicio');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(informacionEscolar.record?.semester ?? 1);
  const [materias, setMaterias] = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState([]);
  const [motivosBaja, setMotivosBaja] = useState({});
  const [contrasenas, setContrasenas] = useState(CONTRASENAS_VACIAS);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mostrarTiposSangre, setMostrarTiposSangre] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [guardandoContrasena, setGuardandoContrasena] = useState(false);
  const [solicitandoRestablecimiento, setSolicitandoRestablecimiento] = useState(false);
  const [solicitandoBaja, setSolicitandoBaja] = useState(null);

  const cargarDatosAcademicos = async () => {
    setCargando(true);
    setError('');
    try {
      const [resultadoMaterias, resultadoInscripciones] = await Promise.all([
        obtenerMateriasApi(autenticacion.jwt),
        obtenerInscripcionesApi(autenticacion.jwt),
      ]);
      setMaterias(resultadoMaterias.subjects);
      setInscripciones(resultadoInscripciones.enrollments);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatosAcademicos();
  }, [autenticacion.jwt]);

  const estadoPorMateria = useMemo(() => {
    const estados = new Map();
    for (const materia of materias) {
      const historial = inscripciones.filter((item) => item.subject?.id === materia.id);
      let status = 'not_taken';
      if (historial.some((item) => item.status === 'passed')) status = 'passed';
      else if (historial[0]?.status === 'failed') status = 'failed';
      else if (historial[0]?.status === 'pending') status = 'pending';
      else if (historial[0]?.status === 'enrolled') status = 'enrolled';
      estados.set(materia.id, status);
    }
    return estados;
  }, [materias, inscripciones]);

  const materiasCursadas = new Set(
    inscripciones
      .filter((item) => item.status === 'passed' && item.countsTowardProgress !== false)
      .map((item) => item.subject?.id)
      .filter(Boolean)
  );
  const materiasOptativasOctavo = materias.filter((item) => item.isElective && item.semester === 8);
  const materiasOptativasNoveno = materias.filter((item) => item.isElective && item.semester === 9);
  const creditosTotales = materias.filter((item) => !item.isElective).reduce((total, item) => total + item.credits, 0) +
    materiasOptativasOctavo.slice(0, 1).reduce((total, item) => total + item.credits, 0) +
    materiasOptativasNoveno.slice(0, 2).reduce((total, item) => total + item.credits, 0);
  const creditosCursados = [...materiasCursadas].reduce((total, id) => {
    const materia = materias.find((item) => item.id === id);
    return total + (materia?.credits ?? 0);
  }, 0);
  const avance = creditosTotales ? Math.round((creditosCursados / creditosTotales) * 100) : 0;
  const periodosConInscripciones = [...new Set(inscripciones
    .map((item) => item.semester ?? item.subject?.semester)
    .filter((periodo) => Number.isInteger(periodo)))]
    .sort((a, b) => a - b);
  const periodosConcluidos = periodosConInscripciones.filter((periodo) => {
    const delPeriodo = inscripciones.filter((item) => (item.semester ?? item.subject?.semester) === periodo);
    return delPeriodo.length > 0 && delPeriodo.every((item) => ['passed', 'failed', 'withdrawn'].includes(item.status));
  });
  const periodoMostrado = periodosConcluidos.includes(periodoSeleccionado)
    ? periodoSeleccionado
    : periodosConcluidos[periodosConcluidos.length - 1];
  const perfilValido =
    typeof perfil.firstName === 'string' && perfil.firstName.trim().length > 0 &&
    typeof perfil.lastName === 'string' && perfil.lastName.trim().length > 0 &&
    typeof perfil.address === 'string' && perfil.address.trim().length > 0 &&
    /^\d{10}$/.test(perfil.contactPhone ?? '') &&
    /^\d{5}$/.test(perfil.postalCode ?? '') &&
    typeof perfil.parentNames === 'string' && perfil.parentNames.trim().length > 0 &&
    TIPOS_SANGRE.includes(perfil.bloodType) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(perfil.contactEmail ?? '');
  const materiasDisponibles = materias.filter((materia) =>
    !inscripciones.some((item) =>
      item.subject?.id === materia.id && ['pending', 'enrolled', 'passed'].includes(item.status)
    )
  );
  const inscripcionesDelPeriodo = inscripciones.filter((item) =>
    (item.semester ?? item.subject?.semester) === periodoMostrado &&
    ['passed', 'failed'].includes(item.status)
  );

  const guardarPerfil = async () => {
    setGuardandoPerfil(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await actualizarPerfilApi(autenticacion.jwt, perfil);
      setExpediente(resultado.record);
      setPerfil({ ...PERFIL_VACIO, ...resultado.record });
      setMensaje('Tus datos personales se guardaron correctamente.');
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cambiarContrasena = async () => {
    setGuardandoContrasena(true);
    setError('');
    setMensaje('');
    try {
      await cambiarContrasenaApi(autenticacion.jwt, contrasenas);
      setContrasenas(CONTRASENAS_VACIAS);
      setMensaje('Tu contraseña se cambió correctamente.');
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardandoContrasena(false);
    }
  };

  const solicitarRestablecimiento = async () => {
    setSolicitandoRestablecimiento(true);
    setError('');
    setMensaje('');
    try {
      await solicitarRestablecimientoApi(autenticacion.jwt);
      setExpediente({ ...expediente, passwordResetRequested: true });
      setMensaje('La solicitud de restablecimiento fue enviada al administrador.');
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setSolicitandoRestablecimiento(false);
    }
  };

  const enviarSolicitudInscripcion = async () => {
    setEnviandoSolicitud(true);
    setError('');
    setMensaje('');
    try {
      await solicitarInscripcionApi(autenticacion.jwt, { subjectIds: materiasSeleccionadas });
      setMateriasSeleccionadas([]);
      setMensaje('La solicitud de inscripción fue enviada al administrador.');
      await cargarDatosAcademicos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const alternarMateria = (materiaId) => {
    setMateriasSeleccionadas((actuales) => {
      if (actuales.includes(materiaId)) return actuales.filter((id) => id !== materiaId);
      if (actuales.length >= 7) {
        setError('Puedes seleccionar hasta 7 materias por inscripción.');
        return actuales;
      }
      setError('');
      return [...actuales, materiaId];
    });
  };

  const solicitarBaja = async (inscripcion) => {
    const reason = motivosBaja[inscripcion.id];
    if (!reason) {
      setError('Selecciona el motivo de la baja.');
      return;
    }
    setSolicitandoBaja(inscripcion.id);
    setError('');
    setMensaje('');
    try {
      await solicitarBajaMateriaApi(autenticacion.jwt, inscripcion.id, reason);
      setMensaje('La solicitud de baja fue enviada al administrador.');
      await cargarDatosAcademicos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setSolicitandoBaja(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="bodySmall" style={styles.eyebrow}>PORTAL DEL ALUMNO</Text>
      <Text variant="headlineSmall" style={styles.title}>
        Hola, {expediente?.fullName || usuario.username}
      </Text>
      <Text variant="bodyMedium" style={styles.email}>
        {expediente?.accountNumber
          ? `Cuenta ${expediente.accountNumber} · Carrera ${expediente.career}`
          : usuario.email}
      </Text>
      {expediente?.withdrawn && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subjectStatus}>Estás dado de baja</Text>
            <Text variant="bodyMedium" style={styles.description}>
              Tu cuenta permanece activa para consultar tu información, pero no puedes inscribirte ni modificar tus datos.
            </Text>
          </Card.Content>
        </Card>
      )}
      <View style={styles.navigation}>
        <BotonSeccion seleccionado={seccion === 'inicio'} onPress={() => setSeccion('inicio')}>Inicio</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'datos'} onPress={() => setSeccion('datos')}>Datos personales</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'periodoActual'} onPress={() => setSeccion('periodoActual')}>Periodo actual</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'trayectoria'} onPress={() => setSeccion('trayectoria')}>Trayectoria</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'inscripcion'} onPress={() => setSeccion('inscripcion')}>Inscripción</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'bajas'} onPress={() => setSeccion('bajas')}>Baja de materias</BotonSeccion>
        <BotonSeccion seleccionado={seccion === 'seguridad'} onPress={() => setSeccion('seguridad')}>Contraseña</BotonSeccion>
      </View>
      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <HelperText type="info" visible={Boolean(mensaje)}>{mensaje}</HelperText>

      {cargando && <Text style={styles.description}>Cargando información académica...</Text>}
      {!cargando && seccion === 'inicio' && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>Resumen académico</Text>
            <Text variant="titleMedium" style={styles.progress}>
              Periodo actual: {expediente?.semester ?? 1}
            </Text>
            <Text variant="bodyMedium" style={styles.description}>
              Avance: {creditosCursados} de {creditosTotales} créditos ({avance}%).
            </Text>
            <Text variant="bodyMedium" style={styles.description}>
              Selecciona una opción para consultar tus datos, trayectoria, inscripción o seguridad.
            </Text>
          </Card.Content>
        </Card>
      )}

      {!cargando && seccion === 'periodoActual' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Periodo actual · {expediente?.semester ?? 1}</Text>
          <Card style={styles.card}>
            <Card.Content>
              {inscripciones.filter((item) => item.status === 'enrolled').length ? (
                inscripciones.filter((item) => item.status === 'enrolled').map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <Text variant="titleMedium" style={styles.subjectName}>
                      {item.subject?.code} · {item.subject?.name}
                    </Text>
                    <Text variant="bodySmall" style={styles.description}>
                      {item.attempt > 1 ? 'Recursamiento' : 'En curso'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.description}>No tienes materias en curso actualmente.</Text>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      {!cargando && seccion === 'datos' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Datos personales</Text>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.description}>
                Completa todos los campos para guardar tu expediente. Nombre y apellidos se registran por separado.
              </Text>
              <TextInput label="Nombre" value={perfil.firstName} onChangeText={(value) => setPerfil({ ...perfil, firstName: value })} editable={!expediente?.withdrawn} style={styles.input} />
              <TextInput label="Apellidos" value={perfil.lastName} onChangeText={(value) => setPerfil({ ...perfil, lastName: value })} editable={!expediente?.withdrawn} style={styles.input} />
              <TextInput label="Dirección" value={perfil.address} onChangeText={(value) => setPerfil({ ...perfil, address: value })} editable={!expediente?.withdrawn} style={styles.input} />
              <TextInput
                label="Teléfono de contacto"
                value={perfil.contactPhone}
                onChangeText={(value) => setPerfil({ ...perfil, contactPhone: value.replace(/\D/g, '').slice(0, 10) })}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!expediente?.withdrawn}
                style={styles.input}
              />
              <TextInput label="Correo de contacto" value={perfil.contactEmail} onChangeText={(value) => setPerfil({ ...perfil, contactEmail: value })} keyboardType="email-address" autoCapitalize="none" editable={!expediente?.withdrawn} style={styles.input} />
              <TextInput label="Nombre de los padres o tutores" value={perfil.parentNames} onChangeText={(value) => setPerfil({ ...perfil, parentNames: value })} editable={!expediente?.withdrawn} style={styles.input} />
              <Text variant="bodyMedium" style={styles.inputLabel}>Tipo de sangre</Text>
              <Menu
                visible={mostrarTiposSangre}
                onDismiss={() => setMostrarTiposSangre(false)}
                anchor={(
                  <Button
                    mode="outlined"
                    icon="chevron-down"
                    disabled={Boolean(expediente?.withdrawn)}
                    onPress={() => setMostrarTiposSangre(true)}
                    style={styles.input}
                    contentStyle={styles.dropdownButton}
                  >
                    {perfil.bloodType || 'Selecciona un tipo de sangre'}
                  </Button>
                )}
              >
                {TIPOS_SANGRE.map((tipo) => (
                  <Menu.Item key={tipo} title={tipo} onPress={() => {
                    setPerfil({ ...perfil, bloodType: tipo });
                    setMostrarTiposSangre(false);
                  }} />
                ))}
              </Menu>
              <TextInput
                label="Código postal"
                value={perfil.postalCode}
                onChangeText={(value) => setPerfil({ ...perfil, postalCode: value.replace(/\D/g, '').slice(0, 5) })}
                keyboardType="number-pad"
                maxLength={5}
                editable={!expediente?.withdrawn}
                style={styles.input}
              />
              {!expediente?.withdrawn && (
                <Button mode="contained" onPress={guardarPerfil} loading={guardandoPerfil} disabled={guardandoPerfil || !perfilValido} style={styles.action}>
                  Guardar datos personales
                </Button>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      {!cargando && seccion === 'trayectoria' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Trayectoria académica</Text>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.progress}>
                Avance: {creditosCursados} de {creditosTotales} créditos ({avance}%)
              </Text>
              <View style={styles.periodOptions}>
                {periodosConcluidos.map((periodo) => (
                  <BotonSeccion key={periodo} seleccionado={periodoSeleccionado === periodo} onPress={() => setPeriodoSeleccionado(periodo)}>
                    Periodo {periodo}
                  </BotonSeccion>
                ))}
              </View>
              <Divider style={styles.divider} />
              {inscripcionesDelPeriodo.length ? (
                <>
                  <Text variant="titleMedium" style={styles.subheading}>Periodo {periodoMostrado}</Text>
                  {inscripcionesDelPeriodo.map((item) => (
                    <View key={item.id} style={styles.subject}>
                      <View style={styles.subjectInfo}>
                        <Text variant="bodyMedium" style={styles.subjectName}>{item.subject?.name}</Text>
                        <Text variant="bodySmall" style={styles.description}>
                          {item.subject?.code} · Ordinario: {item.ordinaryGrade ?? '—'}
                          {item.extraGrade !== null ? ` · Extra: ${item.extraGrade}` : ''}
                          {item.titleGrade !== null ? ` · Título: ${item.titleGrade}` : ''}
                          {item.attempt > 1 ? ' · Recursamiento' : ''}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={item.status === 'passed' ? styles.passed : styles.subjectStatus}>
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.description}>Los periodos aparecerán cuando todas sus materias tengan resultado final.</Text>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      {!cargando && seccion === 'inscripcion' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Inscripción</Text>
          <Card style={styles.card}>
            <Card.Content>
              {expediente?.withdrawn ? (
                <Text style={styles.description}>Tu cuenta está dada de baja; puedes consultar tu historial, pero no inscribirte.</Text>
              ) : !expediente?.enrollmentEnabled || expediente?.withdrawalEligible ? (
                <Text style={styles.description}>
                  {expediente?.withdrawalEligible
                    ? 'La inscripción está bloqueada porque tienes pendiente una baja administrativa.'
                    : 'La inscripción está bloqueada. El administrador debe autorizar tu acceso.'}
                </Text>
              ) : (
                <>
                  <Text style={styles.description}>Selecciona materias</Text>
                  {materiasDisponibles.map((materia) => {
                    const seleccionada = materiasSeleccionadas.includes(materia.id);
                    const esRecursamiento = estadoPorMateria.get(materia.id) === 'failed';
                    return (
                      <Button
                        key={materia.id}
                        mode={seleccionada ? 'contained' : 'outlined'}
                        onPress={() => alternarMateria(materia.id)}
                        style={styles.subjectOption}
                        contentStyle={styles.subjectButtonContent}
                      >
                        {`${seleccionada ? '✓ ' : ''}${materia.code} · ${materia.name}${esRecursamiento ? ' · Recursamiento' : ''}`}
                      </Button>
                    );
                  })}
                  {materiasDisponibles.length === 0 && (
                    <Text style={styles.description}>No hay materias disponibles para el periodo {expediente?.semester}.</Text>
                  )}
                  <Button
                    mode="contained"
                    onPress={enviarSolicitudInscripcion}
                    loading={enviandoSolicitud}
                    disabled={enviandoSolicitud || !materiasSeleccionadas.length}
                    style={styles.action}
                  >
                    Solicitar inscripción ({materiasSeleccionadas.length}/7)
                  </Button>
                </>
              )}
              <Divider style={styles.divider} />
              <Text variant="titleMedium" style={styles.subheading}>Solicitudes</Text>
              {inscripciones.filter((item) => item.status === 'pending').length ? inscripciones.filter((item) => item.status === 'pending').map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <Text variant="bodyMedium" style={styles.subjectName}>
                    {item.subject?.code} · {item.subject?.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.description}>
                    Periodo {item.semester ?? item.subject?.semester} · Pendiente de aprobación
                  </Text>
                </View>
              )) : <Text style={styles.description}>No tienes solicitudes pendientes.</Text>}
            </Card.Content>
          </Card>
        </>
      )}

      {!cargando && seccion === 'bajas' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Baja de materias</Text>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.description}>Selecciona el motivo y solicita la baja de una materia que estés cursando.</Text>
              {inscripciones.filter((item) => item.status === 'enrolled').length ? (
                inscripciones.filter((item) => item.status === 'enrolled').map((item) => {
                  const tieneCalificacion = item.grade != null ||
                    item.ordinaryGrade != null ||
                    item.extraGrade != null ||
                    item.titleGrade != null;
                  return (
                    <View key={item.id} style={styles.historyRow}>
                      <Text variant="titleMedium" style={styles.subjectName}>
                        {item.subject?.code} · {item.subject?.name}
                      </Text>
                      {item.withdrawalRequested ? (
                        <Text style={styles.description}>Solicitud pendiente de aprobación.</Text>
                      ) : tieneCalificacion ? (
                        <Text style={styles.description}>Ya se registró una calificación; no se puede solicitar la baja.</Text>
                      ) : (
                        <>
                          <View style={styles.periodOptions}>
                            {MOTIVOS_BAJA.map((motivo) => (
                              <BotonSeccion
                                key={motivo.value}
                                seleccionado={motivosBaja[item.id] === motivo.value}
                                onPress={() => setMotivosBaja({ ...motivosBaja, [item.id]: motivo.value })}
                              >
                                {motivo.label}
                              </BotonSeccion>
                            ))}
                          </View>
                          <Button
                            mode="outlined"
                            onPress={() => solicitarBaja(item)}
                            loading={solicitandoBaja === item.id}
                            disabled={solicitandoBaja !== null}
                            style={styles.action}
                          >
                            Solicitar baja
                          </Button>
                        </>
                      )}
                    </View>
                  );
                })
              ) : <Text style={styles.description}>No tienes materias cursando disponibles para baja.</Text>}
            </Card.Content>
          </Card>
        </>
      )}

      {!cargando && seccion === 'seguridad' && (
        <>
          <Text variant="titleLarge" style={styles.sectionTitle}>Seguridad de la cuenta</Text>
          {!expediente?.withdrawn && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="bodyMedium" style={styles.description}>Cambia tu contraseña con tu contraseña actual y una nueva de al menos 6 caracteres.</Text>
                <TextInput label="Contraseña actual" value={contrasenas.currentPassword} onChangeText={(value) => setContrasenas({ ...contrasenas, currentPassword: value })} secureTextEntry style={styles.input} />
                <TextInput label="Nueva contraseña (mínimo 6 caracteres)" value={contrasenas.newPassword} onChangeText={(value) => setContrasenas({ ...contrasenas, newPassword: value })} secureTextEntry style={styles.input} />
                <TextInput label="Confirmar nueva contraseña" value={contrasenas.confirmPassword} onChangeText={(value) => setContrasenas({ ...contrasenas, confirmPassword: value })} secureTextEntry style={styles.input} />
                <Button
                  mode="contained"
                  onPress={cambiarContrasena}
                  loading={guardandoContrasena}
                  disabled={guardandoContrasena || !contrasenas.currentPassword || contrasenas.newPassword.length < 6 || contrasenas.newPassword !== contrasenas.confirmPassword}
                  style={styles.action}
                >
                  Actualizar contraseña
                </Button>
              </Card.Content>
            </Card>
          )}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.subheading}>Restablecimiento de contraseña</Text>
              {expediente?.passwordResetRequested ? (
                <Text style={styles.description}>Tu solicitud ya fue enviada. El administrador debe restablecer tu contraseña.</Text>
              ) : (
                <>
                  <Text style={styles.description}>Envía una solicitud al administrador si no recuerdas tu contraseña.</Text>
                  <Button mode="outlined" icon="lock-reset" onPress={solicitarRestablecimiento} loading={solicitandoRestablecimiento} disabled={solicitandoRestablecimiento || expediente?.withdrawn} style={styles.action}>
                    Solicitar restablecimiento
                  </Button>
                </>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      <Button mode="outlined" icon="logout" onPress={cerrarSesion} style={styles.logout}>Cerrar sesión</Button>
    </ScrollView>
  );
};

const statusLabel = (status) => ({
  passed: 'Acreditada',
  enrolled: 'En curso',
  pending: 'Pendiente',
  failed: 'Recursar materia',
  not_taken: 'Falta por tomar',
}[status] ?? 'Falta por tomar');

const BotonSeccion = ({ seleccionado, onPress, children }) => (
  <Button mode={seleccionado ? 'contained' : 'outlined'} compact onPress={onPress} style={styles.botonSeccion}>
    {children}
  </Button>
);

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 32, paddingBottom: 36, backgroundColor: '#f4f7fb' },
  eyebrow: { color: '#176b87', fontWeight: '700', letterSpacing: 1 },
  title: { color: '#1d2d44', fontWeight: '700', marginTop: 8 },
  email: { color: '#69788b', marginTop: 4, marginBottom: 12 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 4 },
  botonSeccion: { marginRight: 6, marginBottom: 6 },
  sectionTitle: { color: '#1d2d44', fontWeight: '700', marginTop: 12, marginBottom: 12 },
  card: { borderRadius: 16, marginBottom: 8, backgroundColor: '#fff' },
  description: { color: '#69788b', marginTop: 4, lineHeight: 21 },
  input: { marginTop: 12, backgroundColor: '#fff' },
  inputLabel: { color: '#69788b', marginTop: 8 },
  dropdownButton: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  action: { marginTop: 8 },
  progress: { color: '#176b87', fontWeight: '700', marginBottom: 8 },
  periodOptions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  subject: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dce4ec' },
  subjectInfo: { flex: 1, marginRight: 8 },
  subjectName: { color: '#1d2d44', fontWeight: '600' },
  subjectStatus: { color: '#69788b', textAlign: 'right', maxWidth: 130 },
  passed: { color: '#18794e', fontWeight: '700', textAlign: 'right' },
  subjectOption: { marginTop: 8 },
  subjectButtonContent: { minHeight: 46 },
  divider: { marginVertical: 16 },
  subheading: { color: '#1d2d44', fontWeight: '700', marginBottom: 8 },
  historyRow: { paddingVertical: 8 },
  logout: { marginTop: 24, borderColor: '#cbd5e1' },
});

export default Estudiantes;
