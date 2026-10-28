/**
 * Google Drive AppData Sync Service
 * 
 * Безсерверна синхронізація прогресу та записів користувача безпосередньо в його Google Диск
 * у спеціальну приховану папку додатків (Application Data folder: appDataFolder).
 * 
 * Переваги:
 * 1. Безкоштовно назавжди (15 ГБ у кожному Google акаунті).
 * 2. Без бекенду/хостингу (прямі REST-запити з клієнта PWA до Google Drive v3 API).
 * 3. Безпечно: scope 'drive.appdata' не є restricted, доступ має виключно цей додаток.
 * 4. Дані не змішуються зі звичайними файлами на Google Диску користувача.
 */

import { UserProfile, DayLog, ChatMessage } from '../types';

const STORAGE_KEYS = {
  TOKEN: 'sportmaster_gdrive_token_v1',
  EXPIRES_AT: 'sportmaster_gdrive_token_expires_at_v1',
  FILE_ID: 'sportmaster_gdrive_file_id_v1',
  LAST_SYNC: 'sportmaster_gdrive_last_sync_v1'
};

const DATA_FILENAME = 'sportmaster_data_v1.json';

export interface AppDataBackupPayload {
  version: number;
  updatedAt: string;
  profile: UserProfile;
  days: Record<string, DayLog>;
  chat: ChatMessage[];
}

/**
 * Зберегти отриманий Google OAuth Access Token
 */
export function saveGoogleDriveToken(token: string, expiresInSeconds: number = 3600): void {
  try {
    const expiresAt = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
  } catch (e) {
    console.error('Failed to save Google Drive token', e);
  }
}

/**
 * Отримати дійсний Google Access Token (перевіряє чи не минув термін дії)
 */
export function getGoogleDriveToken(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);

    // Додаємо запас 1 хвилину до закінчення токена
    if (token && expiresAt && Date.now() < expiresAt - 60000) {
      return token;
    }
  } catch (e) {
    console.error('Failed to get Google Drive token', e);
  }
  return null;
}

/**
 * Перевірити, чи активний зараз зв'язок з Google Drive
 */
export function isGoogleDriveConnected(): boolean {
  return getGoogleDriveToken() !== null;
}

/**
 * Отримати збережений час останньої синхронізації
 */
export function getLastGoogleDriveSyncTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  } catch (e) {
    return null;
  }
}

/**
 * Очистити збережені токени та ID файлу (наприклад, при виході з акаунту)
 */
export function clearGoogleDriveSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.FILE_ID);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
  } catch (e) {}
}

/**
 * Обробка помилок Google Drive REST API з детальною діагностикою
 */
async function handleDriveApiError(res: Response, action: string): Promise<never> {
  const errData = await res.json().catch(() => ({}));
  const errMsg = errData?.error?.message || '';
  const reason = errData?.error?.errors?.[0]?.reason || '';

  if (res.status === 403) {
    if (
      errMsg.includes('has not been used in project') ||
      errMsg.includes('disabled') ||
      reason === 'accessNotConfigured'
    ) {
      throw new Error(
        'У вашому Google Cloud проєкті вимкнено Google Drive API. Будь ласка, перейдіть за посиланням https://console.cloud.google.com/apis/library/drive.googleapis.com та натисніть «Увімкнути» (Enable).'
      );
    }
    if (reason === 'insufficientPermissions' || errMsg.toLowerCase().includes('insufficient')) {
      clearGoogleDriveSession();
      throw new Error(
        'Сесія не має дозволу на Google Диск. Натисніть «Оновити сесію Google» та надайте доступ до додатка.'
      );
    }
  }

  if (res.status === 401) {
    clearGoogleDriveSession();
    throw new Error('Сесія Google закінчилася. Натисніть «Оновити сесію Google».');
  }

  throw new Error(`Помилка Google Диску (${action} ${res.status}): ${errMsg || 'Запит відхилено'}`);
}

/**
 * Знайти існуючий файл бекапу в папці appDataFolder
 */
async function findAppDataFileId(token: string): Promise<string | null> {
  // Спочатку перевіряємо закешований ID
  const cachedId = localStorage.getItem(STORAGE_KEYS.FILE_ID);
  if (cachedId) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.trashed) return cachedId;
      } else if (checkRes.status === 401 || checkRes.status === 403) {
        await handleDriveApiError(checkRes, 'перевірка');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Google Drive API')) throw e;
    }
  }

  // Пошук за назвою у прихованій папці додатку
  const query = encodeURIComponent(`name='${DATA_FILENAME}' and 'appDataFolder' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    await handleDriveApiError(res, 'пошук');
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    const fileId = data.files[0].id;
    localStorage.setItem(STORAGE_KEYS.FILE_ID, fileId);
    return fileId;
  }

  return null;
}

/**
 * Завантажити вміст файлу бекапу з Google Drive
 */
export async function loadDataFromGoogleDrive(): Promise<AppDataBackupPayload | null> {
  const token = getGoogleDriveToken();
  if (!token) return null;

  try {
    const fileId = await findAppDataFileId(token);
    if (!fileId) return null;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 404) {
        localStorage.removeItem(STORAGE_KEYS.FILE_ID);
        return null;
      }
      await handleDriveApiError(res, 'завантаження');
    }

    const payload: AppDataBackupPayload = await res.json();
    return payload;
  } catch (err: any) {
    console.warn('Google Drive download failed:', err);
    if (err.message && err.message.includes('Google Drive API')) throw err;
    return null;
  }
}

/**
 * Зберегти або оновити бекап у Google Drive (appDataFolder)
 */
export async function syncDataToGoogleDrive(data: {
  profile: UserProfile;
  days: Record<string, DayLog>;
  chat: ChatMessage[];
}): Promise<{ success: boolean; timestamp: string; error?: string }> {
  const token = getGoogleDriveToken();
  if (!token) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Сесія Google не активна або закінчився термін дії. Оновіть вхід через Google.'
    };
  }

  const payload: AppDataBackupPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: data.profile,
    days: data.days,
    chat: data.chat
  };

  try {
    const existingFileId = await findAppDataFileId(token);

    if (existingFileId) {
      // Оновлюємо існуючий файл через PATCH запит
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (patchRes.ok) {
        const now = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
        return { success: true, timestamp: now };
      }

      // Якщо файл видалено (404), створимо новий нижче
      if (patchRes.status === 404) {
        localStorage.removeItem(STORAGE_KEYS.FILE_ID);
      } else {
        await handleDriveApiError(patchRes, 'оновлення');
      }
    }

    // Створюємо новий файл у прихованій папці appDataFolder через multipart/related
    const metadata = {
      name: DATA_FILENAME,
      mimeType: 'application/json',
      parents: ['appDataFolder']
    };

    const boundary = '-------SportMasterBoundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = new Blob(
      [
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: application/json\r\n\r\n',
        JSON.stringify(payload),
        closeDelimiter
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }
    );

    if (!createRes.ok) {
      await handleDriveApiError(createRes, 'створення');
    }

    const createdData = await createRes.json();
    if (createdData.id) {
      localStorage.setItem(STORAGE_KEYS.FILE_ID, createdData.id);
    }

    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
    return { success: true, timestamp: now };
  } catch (err: any) {
    console.error('Google Drive sync error:', err);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message || 'Не вдалося зберегти на Google Диск'
    };
  }
}
