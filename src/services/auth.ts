import { AuthUser, UserAccountCredentials } from '../types/auth';

const STORAGE_KEYS = {
  ACCOUNTS: 'sportmaster_auth_accounts_v2',
  SESSION: 'sportmaster_auth_session_v2'
};

// Hash password with SHA-256 via Web Crypto
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_sportmaster_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getStoredAccounts(): Record<string, UserAccountCredentials> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read accounts', e);
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

/**
 * Register new user with email and password
 */
export async function registerWithEmailPassword(
  displayName: string,
  email: string,
  password: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Введіть коректний email');
  }
  if (!password || password.length < 6) {
    throw new Error('Пароль має містити щонайменше 6 символів');
  }

  const accounts = getStoredAccounts();
  if (accounts[cleanEmail]) {
    throw new Error('Користувач з таким email вже зареєстрований. Спробуйте увійти.');
  }

  const passwordHash = await hashPassword(password);
  const uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  const newUser: AuthUser = {
    uid,
    email: cleanEmail,
    displayName: displayName.trim() || cleanEmail.split('@')[0],
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
 * Log in with existing email and password
 */
export async function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = getStoredAccounts();
  const creds = accounts[cleanEmail];

  if (!creds) {
    throw new Error('Акаунт з таким email не знайдено. Будь ласка, зареєструйтесь.');
  }

  const hash = await hashPassword(password);
  if (creds.passwordHash !== hash) {
    throw new Error('Невірний пароль. Спробуйте ще раз.');
  }

  creds.user.lastLoginAt = new Date().toISOString();
  accounts[cleanEmail] = creds;
  saveStoredAccounts(accounts);
  saveCurrentSession(creds.user);

  return creds.user;
}

/**
 * Authenticate with Google (via OAuth token, JWT credential or direct Google Sign-In)
 */
export async function loginWithGoogleData(googleProfile: {
  email: string;
  name?: string;
  avatar?: string;
  sub?: string;
}): Promise<AuthUser> {
  const cleanEmail = googleProfile.email.trim().toLowerCase();
  const accounts = getStoredAccounts();
  let creds = accounts[cleanEmail];

  if (!creds) {
    // Auto-create account for new Google user
    const uid = googleProfile.sub ? `goog_${googleProfile.sub}` : `usr_g_${Date.now().toString(36)}`;
    const newUser: AuthUser = {
      uid,
      email: cleanEmail,
      displayName: googleProfile.name || cleanEmail.split('@')[0],
      photoURL: googleProfile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      provider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    creds = {
      email: cleanEmail,
      passwordHash: 'GOOGLE_OAUTH_USER',
      user: newUser
    };
  } else {
    creds.user.lastLoginAt = new Date().toISOString();
    if (googleProfile.avatar) creds.user.photoURL = googleProfile.avatar;
    if (googleProfile.name) creds.user.displayName = googleProfile.name;
  }

  accounts[cleanEmail] = creds;
  saveStoredAccounts(accounts);
  saveCurrentSession(creds.user);

  return creds.user;
}

/**
 * Parse Google JWT credential returned by Google Identity Services (GIS)
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
    console.error('Failed to parse JWT', e);
    return null;
  }
}

/**
 * Log out
 */
export function logoutUser() {
  saveCurrentSession(null);
}
