import React, { useState } from 'react';
import { View } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useFormik } from 'formik';
import * as yup from 'yup';
import formStyles from '../styles/forms';
import { loginApi } from '../api/auth';
import useAuth from '../hooks/useAuth';

export default function LoginForm({ changeForm, expectedRole }) {
  const { login } = useAuth();
  const [serverError, setServerError] = useState(null);

  const formik = useFormik({
    initialValues: initialValues(),
    validationSchema: validationSchema(expectedRole),
    onSubmit: async (formData) => {
      setServerError(null);
      try {
        const session = await loginApi(formData);
        await login(session, expectedRole);
      } catch (error) {
        setServerError(error.message);
      }
    },
  });

  const hasError = (field) => Boolean(formik.touched[field] && formik.errors[field]);

  return (
    <View>
      <TextInput
        label={expectedRole === 'authenticated' ? 'Número de cuenta o correo' : 'Usuario o correo electrónico'}
        style={formStyles.input}
        keyboardType="default"
        autoCapitalize="none"
        value={formik.values.email}
        onChangeText={formik.handleChange('email')}
        onBlur={formik.handleBlur('email')}
        error={hasError('email')}
      />
      <HelperText type="error" visible={hasError('email')}>
        {formik.errors.email}
      </HelperText>

      <TextInput
        label="Contraseña"
        style={formStyles.input}
        secureTextEntry
        value={formik.values.password}
        onChangeText={formik.handleChange('password')}
        onBlur={formik.handleBlur('password')}
        error={hasError('password')}
      />
      <HelperText type="error" visible={hasError('password')}>
        {formik.errors.password}
      </HelperText>

      <HelperText type="error" visible={Boolean(serverError)}>
        {serverError}
      </HelperText>

      <Button
        mode="contained"
        style={formStyles.btnSuccess}
        onPress={formik.handleSubmit}
        loading={formik.isSubmitting}
        disabled={formik.isSubmitting}
      >
        Iniciar Sesion
      </Button>
      <Button mode="outlined" style={formStyles.btnText} onPress={changeForm}>
        Volver
      </Button>
    </View>
  );
}

function initialValues() {
  return {
    email: '',
    password: '',
  };
}

function validationSchema(expectedRole) {
  const identifier = yup.string().trim().required('El identificador es obligatorio');
  const accountOrEmail = identifier.test(
    'student-account-or-email',
    'Ingresa un número de cuenta de 7 dígitos o un correo válido',
    (value) => /^\d{7}$/.test(value) || yup.string().email().isValidSync(value)
  );
  const adminUserOrEmail = identifier.test(
    'admin-user-or-email',
    'Ingresa un nombre de usuario o correo válido',
    (value) => /^[a-zA-Z0-9._-]{3,50}$/.test(value) || yup.string().email().isValidSync(value)
  );
  return yup.object({
    email: expectedRole === 'authenticated'
      ? accountOrEmail
      : adminUserOrEmail,
    password: yup.string().required('La contraseña es obligatoria'),
  });
}
