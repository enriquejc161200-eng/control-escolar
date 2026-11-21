import { API_URL } from '../utils/constants';

const ERROR_MESSAGES = {
  'Email or Username are already taken': 'El correo o el nombre de usuario ya están registrados',
  'Invalid identifier or password': 'Correo o contraseña incorrectos',
  'Your account has been blocked by an administrator': 'Tu cuenta fue bloqueada por un administrador',
  'Too many requests, please try again later.': 'Demasiados intentos, prueba de nuevo más tarde',
};

async function request(path, { token, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
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

// Devuelve { jwt, refreshToken, user }
export function registerApi({ username, email, password }) {
  return request('/api/auth/local/register', { body: { username, email, password } });
}

// Devuelve { jwt, refreshToken, user }
export function loginApi({ email, password }) {
  return request('/api/auth/local', { body: { identifier: email, password } });
}

// El jwt dura 10 minutos; el refresh token se rota en cada uso. Devuelve { jwt, refreshToken }
export function refreshApi(refreshToken) {
  return request('/api/auth/refresh', { body: { refreshToken } });
}

export function getMeApi(jwt) {
  return request('/api/users/me', { token: jwt });
}

// Revoca la sesión en el servidor (el refresh token deja de servir)
export function logoutApi(jwt) {
  return request('/api/auth/logout', { token: jwt, body: {} });
}
