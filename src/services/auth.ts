import { AuthUser, UserAccountCredentials } from '../types/auth';

const STORAGE_KEYS = {
  ACCOUNTS: 'sportmaster_auth_accounts_v3',
  SESSION: 'sportmaster_auth_session_v3',
  GOOGLE_CLIENT_ID: 'sportmaster_google_client_id_v1'
};

// Cryptographic SHA-256 password hash
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_sportmaster_salt_2026_secure');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getGoogleClientId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.GOOGLE_CLIENT_ID) || '';
  } catch (e) {
    return '';
  }
}

export function saveGoogleClientId(clientId: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, clientId.trim());
  } catch (e) {
    console.error('Failed to save Google Client ID', e);
  }
}

function getStoredAccounts(): Record<string, UserAccountCredentials> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStoredAccounts(accounts: Record<string, UserAccountCredentials>) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts', e);
  }
}

export function getCurrentSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveCurrentSession(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  } catch (e) {
    console.error('Failed to update session', e);
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user with strict validation
 */
export async function registerWithEmailPassword(
  displayName: string,
  email: string,
  password: string,
  confirmPassword?: string
): Promise<AuthUser> {
  const cleanName = displayName.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 1. Validation checks
  if (!cleanName || cleanName.length < 2) {
    throw new Error('Будь ласка, введіть ваше ім\'я (щонайменше 2 символи)');
  }
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Введіть дійсний формат email (наприклад: name@gmail.com)');
  }
  if (!password || password.length < 6) {
    throw new Error('Пароль має містити щонайменше 6 символів');
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error('Паролі не співпадають. Перевірте введені паролі');
  }

  // 2. Check existing account
  const accounts = getStoredAccounts();
  if (accounts[cleanEmail]) {
    throw new Error('Акаунт з такою поштою вже існує! Будь ласка, перейдіть до вкладки «Вхід».');
  }

  // 3. Create account with secure password hash
  const passwordHash = await hashPassword(password);
  const uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  const newUser: AuthUser = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
    provider: 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  accounts[cleanEmail] = {
    email: cleanEmail,
    passwordHash,
    user: newUser
  };

  saveStoredAccounts(accounts);
  saveCurrentSession(newUser);
  return newUser;
}

/**
 * Log in for registered users only with strict validation
 */
export async function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Введіть коректну email адресу');
  }
  if (!password) {
    throw new Error('Введіть пароль від вашого акаунту');
  }

  const accounts = getStoredAccounts();
  const creds = accounts[cleanEmail];

  // User must be registered!
  if (!creds) {
    throw new Error('Користувача з таким email не знайдено! Будь ласка, спочатку зареєструйтесь.');
  }

  const hash = await hashPassword(password);
  if (creds.passwordHash !== hash) {
    throw new Error('Невірний пароль! Перевірте правильність написання.');
  }

  creds.user.lastLoginAt = new Date().toISOString();
  accounts[cleanEmail] = creds;
  saveStoredAccounts(accounts);
  saveCurrentSession(creds.user);

  return creds.user;
}

/**
 * Register or login with Google profile data directly from Google's servers
 */
export async function loginWithGoogleData(googleProfile: {
  email: string;
  name?: string;
  avatar?: string;
  sub?: string;
}): Promise<AuthUser> {
  const cleanEmail = (googleProfile.email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Не вдалося отримати дійсний email від Google сервера');
  }

  const accounts = getStoredAccounts();
  let creds = accounts[cleanEmail];

  const uid = googleProfile.sub ? `goog_${googleProfile.sub}` : `usr_g_${Date.now().toString(36)}`;
  const user: AuthUser = {
    uid: creds?.user?.uid || uid,
    email: cleanEmail,
    displayName: googleProfile.name || cleanEmail.split('@')[0] || 'Google Користувач',
    photoURL: googleProfile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
    provider: 'google',
    createdAt: creds?.user?.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  accounts[cleanEmail] = {
    email: cleanEmail,
    passwordHash: 'GOOGLE_OAUTH_SERVER_AUTH',
    user
  };

  saveStoredAccounts(accounts);
  saveCurrentSession(user);
  return user;
}

/**
 * Parse Google JWT token
 */
export function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse Google JWT', e);
    return null;
  }
}

/**
 * Direct request to Google OAuth2 token server to sign in directly via Google
 */
export async function signInViaGoogleOAuthServer(clientId?: string): Promise<AuthUser> {
  const effectiveClientId = clientId || getGoogleClientId();

  return new Promise((resolve, reject) => {
    const google = (window as any).google;

    if (google?.accounts?.oauth2 && effectiveClientId) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'email profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            reject(new Error('Помилка авторизації Google: ' + tokenResponse.error));
            return;
          }

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            const info = await res.json();
            const user = await loginWithGoogleData({
              email: info.email,
              name: info.name,
              avatar: info.picture,
              sub: info.sub
            });
            resolve(user);
          } catch (e: any) {
            reject(e);
          }
        }
      });
      client.requestAccessToken();
    } else {
      reject(new Error('Для входу через сервери Google налаштуйте Google Client ID або скористайтесь Реєстрацією'));
    }
  });
}

export function logoutUser() {
  saveCurrentSession(null);
}
