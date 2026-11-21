import React, { useState } from 'react'
import { View } from 'react-native'
import { TextInput, Button, HelperText } from 'react-native-paper'
import formStyles from '../styles/forms'
import { useFormik } from 'formik'
import * as yup from 'yup'
import { registerApi } from '../api/auth'
import useAuth from '../hooks/useAuth'

export default function RegisterForm({ changeForm }) {
  const { login } = useAuth()
  const [serverError, setServerError] = useState(null)

  const formik = useFormik({
    initialValues: initialValues(),
    validationSchema: validationSchema(),
    onSubmit: async (formData) => {
      setServerError(null)
      try {
        const session = await registerApi(formData)
        await login(session)
      } catch (error) {
        setServerError(error.message)
      }
    },
  })

  const hasError = (field) => Boolean(formik.touched[field] && formik.errors[field])

  return (
    <View>
      <HelperText type="info" visible>
        Las cuentas nuevas son de alumno. El administrador debe ser autorizado desde el sistema escolar.
      </HelperText>
      <TextInput
        label="Correo Electronico"
        style={formStyles.input}
        keyboardType="email-address"
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
        label="Nombre de usuario"
        style={formStyles.input}
        autoCapitalize="none"
        value={formik.values.username}
        onChangeText={formik.handleChange('username')}
        onBlur={formik.handleBlur('username')}
        error={hasError('username')}
      />
      <HelperText type="error" visible={hasError('username')}>
        {formik.errors.username}
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

      <TextInput
        label="Repetir Contraseña"
        style={formStyles.input}
        secureTextEntry
        value={formik.values.repeatPassword}
        onChangeText={formik.handleChange('repeatPassword')}
        onBlur={formik.handleBlur('repeatPassword')}
        error={hasError('repeatPassword')}
      />
      <HelperText type="error" visible={hasError('repeatPassword')}>
        {formik.errors.repeatPassword}
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
        Registrarse
      </Button>
      <Button mode="outlined" style={formStyles.btnText} onPress={changeForm}>
        Iniciar Sesion
      </Button>
    </View>
  );
}

function initialValues() {
  return {
    email: "",
    username: "",
    password: "",
    repeatPassword: ""
  }
}

function validationSchema() {
  return yup.object({
    email: yup
      .string()
      .trim()
      .email("El correo electrónico no es válido")
      .required("El correo electrónico es obligatorio"),
    username: yup
      .string()
      .trim()
      .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
      .required("El nombre de usuario es obligatorio"),
    password: yup
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres")
      .required("La contraseña es obligatoria"),
    repeatPassword: yup
      .string()
      .oneOf([yup.ref("password")], "Las contraseñas no coinciden")
      .required("Debes repetir la contraseña"),
  })
}
