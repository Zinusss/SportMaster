import { AuthUser, UserAccountCredentials } from '../types/auth';

const STORAGE_KEYS = {
  ACCOUNTS: 'sportmaster_auth_accounts_v2',
  SESSION: 'sportmaster_auth_session_v2',
  GOOGLE_CLIENT_ID: 'sportmaster_google_client_id_v1'
};

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
 * Register or login with Google profile data directly from Google's servers
 */
export async function loginWithGoogleData(googleProfile: {
  email: string;
  name?: string;
  avatar?: string;
  sub?: string;
}): Promise<AuthUser> {
  const cleanEmail = (googleProfile.email || 'google.user@gmail.com').trim().toLowerCase();
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
 * Parse Google JWT credential token from Google Identity Services
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

    // If Google Identity Services is available and client ID is provided
    if (google?.accounts?.oauth2 && effectiveClientId) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'email profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            reject(new Error(tokenResponse.error));
            return;
          }

          try {
            // Request user details directly from Google's userinfo server
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
      // Fallback: promptless instant Google registration
      const promptEmail = prompt('Введіть ваш Google Email:', 'myaccount@gmail.com');
      if (!promptEmail) {
        reject(new Error('Скасовано'));
        return;
      }
      const cleanName = promptEmail.split('@')[0];
      loginWithGoogleData({
        email: promptEmail,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${promptEmail}`
      }).then(resolve).catch(reject);
    }
  });
}

/**
 * Quick entry with zero validation (no rules, no password requirements)
 */
export async function quickInstantLogin(identifier: string, name?: string): Promise<AuthUser> {
  const cleanId = (identifier || 'user').trim().toLowerCase();
  const email = cleanId.includes('@') ? cleanId : `${cleanId}@gmail.com`;
  const accounts = getStoredAccounts();

  let creds = accounts[email];
  if (!creds) {
    const uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const user: AuthUser = {
      uid,
      email,
      displayName: name || cleanId.split('@')[0] || 'Користувач',
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
      provider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    creds = {
      email,
      passwordHash: 'INSTANT_AUTH',
      user
    };
  }

  accounts[email] = creds;
  saveStoredAccounts(accounts);
  saveCurrentSession(creds.user);
  return creds.user;
}

export function logoutUser() {
  saveCurrentSession(null);
}
