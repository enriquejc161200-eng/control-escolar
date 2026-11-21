import { StyleSheet, View } from 'react-native';
import React, { useState } from 'react';
import { Button, Text as PaperText } from 'react-native-paper';
import layoutStyles from '../styles/layouts';
import LoginForm from '../components/LoginForm';

const Auth = () => {
  const [selectedRole, setSelectedRole] = useState(null);

  return (
    <View style={layoutStyles.container}>
      <PaperText variant="headlineSmall" style={styles.title}>Control Escolar</PaperText>
      {selectedRole ? (
        <View style={styles.loginForm}>
          <LoginForm expectedRole={selectedRole} changeForm={() => setSelectedRole(null)} />
        </View>
      ) : (
        <View style={styles.actions}>
          <PaperText variant="bodyMedium" style={styles.description}>
            Selecciona el tipo de cuenta para ingresar.
          </PaperText>
          <Button mode="contained" onPress={() => setSelectedRole('authenticated')}>
            Ingresar como alumno
          </Button>
          <Button mode="outlined" onPress={() => setSelectedRole('school_admin')}>
            Ingresar como administrador
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title: { color: '#1d2d44', fontWeight: '700', marginVertical: 20, textAlign: 'center', alignSelf: 'center' },
  actions: { width: '100%', gap: 12 },
  loginForm: { width: '100%' },
  description: { color: '#69788b', textAlign: 'center', marginBottom: 8 },
});

export default Auth;
