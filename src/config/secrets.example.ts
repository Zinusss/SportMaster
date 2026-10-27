/**
 * Шаблон для секретних ключів.
 * Для локальної розробки скопіюйте цей файл у "src/config/secrets.ts"
 * та вставте ваші реальні ключі.
 * Файл "src/config/secrets.ts" додано в .gitignore і він ніколи не потрапить на GitHub.
 */
export const SECRETS = {
  // Ваш Google OAuth 2.0 Web Client ID з Google Cloud Console
  // Створюється безкоштовно на https://console.cloud.google.com/apis/credentials
  googleClientId: '',

  // Ваш Google Gemini API Key з Google AI Studio
  // Отримується безкоштовно на https://aistudio.google.com/app/apikey
  geminiApiKey: ''
};
