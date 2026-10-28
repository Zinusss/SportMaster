const STORAGE_KEYS = {
  CLIENT_ID: 'sportmaster_google_client_id_v2'
};

/**
 * Офіційний Google OAuth 2.0 Web Client ID додатку SportMaster AI
 */
export const DEFAULT_GOOGLE_CLIENT_ID = '316953474615-lsngumkt43hundno1vvjuljfl0pnk13p.apps.googleusercontent.com';

// Автоматично очищаємо старі закешовані неробочі ключі з localStorage користувача
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  }
} catch (e) {}

/**
 * Налаштування Google OAuth 2.0 (тільки для входу через Google)
 */
export const OAUTH_CONFIG = {
  // Ендпоінт авторизації Google (відкриває accountchooser)
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',

  // Ендпоінт для отримання даних користувача
  userinfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',

  // Необхідні дозволи для профілю та синхронізації у приховану папку Google Диску
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.appdata'
  ],

  /**
   * Отримати Google Client ID:
   * Завжди повертає актуальний офіційний Client ID додатку
   */
  getClientId(): string {
    return DEFAULT_GOOGLE_CLIENT_ID;
  },

  /**
   * Зберегти Client ID
   */
  setClientId(_clientId: string) {
    // Вшитий Client ID є фіксованим
  },

  /**
   * Поточний Redirect URI для GitHub Pages або localhost (з нормалізацією слеша)
   */
  getRedirectUri(): string {
    if (typeof window === 'undefined') return '';
    let path = window.location.pathname;
    if (!path.endsWith('/')) {
      path += '/';
    }
    return window.location.origin + path;
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
      prompt: 'consent select_account' // Примусово запитує згоду користувача на роботу з Google Диском
    });

    return `${this.authEndpoint}?${params.toString()}`;
  }
};
