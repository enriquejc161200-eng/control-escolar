import * as SecureStore from 'expo-secure-store';
import { JWT_KEY, REFRESH_TOKEN_KEY } from './constants';

export async function setTokens(jwt, refreshToken) {
  await SecureStore.setItemAsync(JWT_KEY, jwt);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function removeTokens() {
  await SecureStore.deleteItemAsync(JWT_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
