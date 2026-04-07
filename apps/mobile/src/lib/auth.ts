import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mars_auth_token';
const TOKEN_EXPIRY_KEY = 'mars_token_expiry';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Authenticate with the backend and persist the token in SecureStore.
 */
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || 'Invalid credentials');
  }

  const data = await res.json();
  const token: string = data.token ?? data.access_token ?? '';

  if (!token) {
    throw new Error('No token returned from server');
  }

  // Default expiry: 7 days from now
  const expiryMs =
    data.expires_in != null
      ? Date.now() + data.expires_in * 1000
      : Date.now() + 7 * 24 * 60 * 60 * 1000;

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiryMs.toString());
}

/**
 * Clear all stored auth data.
 */
export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
}

/**
 * Retrieve the stored token, or null if none exists.
 */
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Returns true if a non-expired token exists in SecureStore.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  const expiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
  if (expiry && Number(expiry) < Date.now()) {
    // Token expired -- clean up
    await logout();
    return false;
  }

  return true;
}
