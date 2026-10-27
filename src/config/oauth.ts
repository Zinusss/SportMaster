import { SECRETS } from './secrets';

const STORAGE_KEYS = {
  CLIENT_ID: 'sportmaster_google_client_id_v2'
};

/**
 * Налаштування Google OAuth 2.0 (тільки для входу через Google)
 */
export const OAUTH_CONFIG = {
  // Ендпоінт авторизації Google (відкриває accountchooser)
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',

  // Ендпоінт для отримання даних користувача
  userinfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',

  // Необхідні дозволи для профілю
  scopes: ['email', 'profile', 'openid'],

  /**
   * Отримати Google Client ID:
   * 1. З окремого файлу src/config/secrets.ts
   * 2. Зі змінних оточення Vite (VITE_GOOGLE_CLIENT_ID)
   * 3. З localStorage браузера
   */
  getClientId(): string {
    // 1. Зі змінних оточення Vite / GitHub Secrets під час збірки
    const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envClientId && typeof envClientId === 'string' && envClientId.trim()) {
      return envClientId.trim();
    }

    // 2. З окремого локального конфіг-файлу secrets.ts
    if (SECRETS.googleClientId && SECRETS.googleClientId.trim()) {
      return SECRETS.googleClientId.trim();
    }

    // 3. З пам'яті браузера
    try {
      return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
    } catch (e) {
      return '';
    }
  },

  /**
   * Зберегти Client ID в пам'ять браузера
   */
  setClientId(clientId: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
    } catch (e) {
      console.error('Failed to save Client ID to localStorage', e);
    }
  },

  /**
   * Поточний Redirect URI для GitHub Pages або localhost
   */
  getRedirectUri(): string {
    if (typeof window === 'undefined') return '';
    return window.location.origin + window.location.pathname;
  },

  /**
   * Сформувати посилання для перенаправлення на https://accounts.google.com/v3/signin/accountchooser
   */
  getAuthUrl(customClientId?: string): string {
    const clientId = (customClientId || this.getClientId()).trim();
    if (!clientId) return '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'token',
      scope: this.scopes.join(' '),
      prompt: 'select_account' // Примусово відкриває сторінку вибору акаунта
    });

    return `${this.authEndpoint}?${params.toString()}`;
  }
};
