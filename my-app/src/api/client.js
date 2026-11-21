import { API_URL } from '../utils/constants';

const ERROR_MESSAGES = {
  'Email or Username are already taken': 'El correo o el nombre de usuario ya están registrados',
  'Invalid identifier or password': 'Correo o contraseña incorrectos',
  'Your account has been blocked by an administrator': 'Tu cuenta fue bloqueada por un administrador',
  'Too many requests, please try again later.': 'Demasiados intentos, prueba de nuevo más tarde',
};

export async function request(path, { token, body, method } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.error?.message;
    const error = new Error(ERROR_MESSAGES[message] ?? message ?? 'Error inesperado del servidor');
    error.status = response.status;
    throw error;
  }

  return result;
}
