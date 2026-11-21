import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { getSchoolMeApi } from '../api/school';
import useAuth from '../hooks/useAuth';
import Administrador from './Administrador';
import Estudiantes from './Estudiantes';
import Calificaciones from './Calificaciones';

const Home = () => {
  const { auth, logout } = useAuth();
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSchoolInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const info = await getSchoolMeApi(auth.jwt);
      setSchoolInfo(info);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchoolInfo();
  }, [auth.jwt]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  if (error) {
    return (
      <>
        <Text style={{ margin: 24 }}>{error}</Text>
        <Button onPress={loadSchoolInfo}>Reintentar</Button>
      </>
    );
  }

  if (['school_admin', 'school_grade_capturer'].includes(schoolInfo.role)) {
    if (auth.expectedRole && auth.expectedRole !== 'school_admin') {
      return <RoleMismatch selectedRole="alumno" logout={logout} />;
    }
    if (schoolInfo.role === 'school_grade_capturer') {
      return <Calificaciones auth={auth} logout={logout} />;
    }
    return <Administrador auth={auth} logout={logout} />;
  }

  if (schoolInfo.role === 'authenticated') {
    if (auth.expectedRole && auth.expectedRole !== 'authenticated') {
      return <RoleMismatch selectedRole="administrador" logout={logout} />;
    }
    return <Estudiantes schoolInfo={schoolInfo} logout={logout} auth={auth} />;
  }

  return <Text style={{ margin: 24 }}>Tu cuenta no tiene un rol escolar válido.</Text>;
};

const RoleMismatch = ({ selectedRole, logout }) => (
  <>
    <Text style={{ margin: 24 }}>
      Esta cuenta no corresponde a la opción “ingresar como {selectedRole}”.
    </Text>
    <Button onPress={logout}>Volver al inicio</Button>
  </>
);

export default Home;
