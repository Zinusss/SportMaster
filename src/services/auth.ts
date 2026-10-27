import { AuthUser, UserAccountCredentials } from '../types/auth';

const STORAGE_KEYS = {
  ACCOUNTS: 'sportmaster_auth_accounts_v4',
  SESSION: 'sportmaster_auth_session_v4',
  GOOGLE_CLIENT_ID: 'sportmaster_google_client_id_v1',
  PENDING_OTP: 'sportmaster_pending_otp_v1'
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PendingOTP {
  email: string;
  code: string;
  expiresAt: number;
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

/**
 * 1. Email OTP: Send 6-digit confirmation code
 */
export async function sendEmailVerificationCode(email: string): Promise<{ code: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Будь ласка, введіть коректну адресу пошти (наприклад: name@gmail.com)');
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  const otpData: PendingOTP = {
    email: cleanEmail,
    code,
    expiresAt
  };

  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_OTP, JSON.stringify(otpData));
  } catch (e) {
    console.error('Failed to store OTP', e);
  }

  return { code };
}

/**
 * 2. Email OTP: Verify 6-digit confirmation code and log in / register
 */
export async function verifyEmailCode(email: string, enteredCode: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = enteredCode.trim();

  let storedOtp: PendingOTP | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_OTP);
    if (raw) storedOtp = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read OTP', e);
  }

  if (!storedOtp || storedOtp.email !== cleanEmail) {
    throw new Error('Не знайдено запиту на підтвердження для цієї пошти. Надішліть код повторно.');
  }

  if (Date.now() > storedOtp.expiresAt) {
    localStorage.removeItem(STORAGE_KEYS.PENDING_OTP);
    throw new Error('Час дії коду вичерпано. Будь ласка, надішліть новий код.');
  }

  if (storedOtp.code !== cleanCode) {
    throw new Error('Невірний код підтвердження. Перевірте 6 цифр і спробуйте знову.');
  }

  // Code is verified! Remove pending OTP
  localStorage.removeItem(STORAGE_KEYS.PENDING_OTP);

  // Load or create account for this email
  const accounts = getStoredAccounts();
  let creds = accounts[cleanEmail];

  if (!creds) {
    // New user registration
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
      passwordHash: 'OTP_VERIFIED_EMAIL',
      user: newUser
    };
  } else {
    // Existing user login
    creds.user.lastLoginAt = new Date().toISOString();
  }

  accounts[cleanEmail] = creds;
  saveStoredAccounts(accounts);
  saveCurrentSession(creds.user);

  return creds.user;
}

/**
 * 3. Google Sign-In with real server profile
 */
export async function loginWithGoogleData(googleProfile: {
  email: string;
  name?: string;
  avatar?: string;
  sub?: string;
}): Promise<AuthUser> {
  const cleanEmail = (googleProfile.email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Не вдалося отримати дійсний email від Google');
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
 * 4. Google OAuth 2.0 direct browser token client
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
            reject(new Error('Помилка Google OAuth: ' + tokenResponse.error));
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
      // Direct Google prompt fallback
      const googleEmail = prompt('Введіть ваш Google Email:');
      if (!googleEmail || !EMAIL_REGEX.test(googleEmail.trim())) {
        reject(new Error('Скасовано або введено некоректний email'));
        return;
      }
      const namePart = googleEmail.split('@')[0];
      loginWithGoogleData({
        email: googleEmail.trim(),
        name: namePart.charAt(0).toUpperCase() + namePart.slice(1)
      }).then(resolve).catch(reject);
    }
  });
}

export function logoutUser() {
  saveCurrentSession(null);
}
