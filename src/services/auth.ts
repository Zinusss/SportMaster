import { AuthUser, UserAccountCredentials } from '../types/auth';
import { OAUTH_CONFIG } from '../config/oauth';
import { clearGoogleDriveSession } from './googleDriveSync';

const STORAGE_KEYS = {
  ACCOUNTS: 'sportmaster_auth_accounts_v4',
  SESSION: 'sportmaster_auth_session_v4'
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getGoogleClientId(): string {
  return OAUTH_CONFIG.getClientId();
}

export function saveGoogleClientId(clientId: string) {
  OAUTH_CONFIG.setClientId(clientId);
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

/**
 * Отримати посилання авторизації Google OAuth 2.0 (відкриває accountchooser)
 */
export function getGoogleOAuthRedirectUrl(clientId?: string): string {
  return OAUTH_CONFIG.getAuthUrl(clientId);
}

/**
 * Хешування пароля через Web Crypto API SHA-256
 */
async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Резервний простий хеш для оточень без Web Crypto
    return btoa(unescape(encodeURIComponent(password)));
  }
}

/**
 * Вхід або реєстрація за Email та паролем (працює миттєво, без очікування пошти)
 */
export async function loginOrRegisterWithEmail(
  email: string, 
  password: string
): Promise<{ user: AuthUser; isNew: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Введіть коректну адресу пошти (наприклад: name@gmail.com)');
  }

  if (!password || password.length < 4) {
    throw new Error('Пароль має містити щонайменше 4 символи');
  }

  const accounts = getStoredAccounts();
  const passwordHash = await hashPassword(password);
  let creds = accounts[cleanEmail];

  if (!creds) {
    // Новий користувач -> Реєстрація
    const uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const displayName = cleanEmail.split('@')[0];
    const newUser: AuthUser = {
      uid,
      email: cleanEmail,
      displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      provider: 'password',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    creds = {
      email: cleanEmail,
      passwordHash,
      user: newUser
    };

    accounts[cleanEmail] = creds;
    saveStoredAccounts(accounts);
    saveCurrentSession(newUser);
    return { user: newUser, isNew: true };
  } else {
    // Існуючий користувач -> Перевірка пароля
    if (creds.passwordHash !== passwordHash && creds.passwordHash !== 'OTP_VERIFIED_USER') {
      throw new Error('Невірний пароль для цієї пошти. Спробуйте ще раз.');
    }

    creds.user.lastLoginAt = new Date().toISOString();
    accounts[cleanEmail] = creds;
    saveStoredAccounts(accounts);
    saveCurrentSession(creds.user);
    return { user: creds.user, isNew: false };
  }
}

/**
 * Швидкий вхід у демо-режимі (гість)
 */
export async function loginAsGuest(): Promise<AuthUser> {
  const guestUid = 'guest_' + Date.now().toString(36);
  const guestUser: AuthUser = {
    uid: guestUid,
    email: 'guest@sportmaster.ai',
    displayName: 'Гість',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=SportGuest',
    provider: 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  saveCurrentSession(guestUser);
  return guestUser;
}

/**
 * Авторизація через реальний профіль Google
 */
export async function loginWithGoogleData(googleProfile: {
  email: string;
  name?: string;
  avatar?: string;
  sub?: string;
}): Promise<AuthUser> {
  const cleanEmail = (googleProfile.email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Не вдалося отримати коректний email від Google');
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

export function logoutUser() {
  saveCurrentSession(null);
  clearGoogleDriveSession();
}
