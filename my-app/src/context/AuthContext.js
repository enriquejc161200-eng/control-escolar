import React, { createContext, useEffect, useState } from 'react';
import { getMeApi, logoutApi, refreshApi } from '../api/auth';
import { getRefreshToken, removeTokens, setTokens } from '../utils/token';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = restaurando sesión, null = sin sesión, { jwt, user } = logueado
  const [auth, setAuth] = useState(undefined);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return setAuth(null);

    try {
      const tokens = await refreshApi(refreshToken);
      await setTokens(tokens.jwt, tokens.refreshToken);
      const user = await getMeApi(tokens.jwt);
      setAuth({ jwt: tokens.jwt, user });
    } catch (error) {
      // Solo se descarta la sesión si el servidor la rechazó, no por falta de red
      if (error.status === 401) await removeTokens();
      setAuth(null);
    }
  };

  const login = async ({ jwt, refreshToken, user }, expectedRole) => {
    await setTokens(jwt, refreshToken);
    setAuth({ jwt, user, expectedRole });
  };

  const logout = async () => {
    try {
      await logoutApi(auth.jwt);
    } catch {
      // Si el jwt ya venció la sesión expira sola en el servidor
    }
    await removeTokens();
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
