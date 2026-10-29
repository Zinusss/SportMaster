import { useState, useEffect, useRef } from 'react';
import { ChatMessage, DayLog, FoodEntry, UserProfile } from '../types';
import { AuthUser } from '../types/auth';
import { calculateNutritionTargets, getTodayKey } from '../utils/nutrition';
import { loadDataFromFirestore, syncDataToFirestore } from '../services/firebase';
import { 
  loadDataFromGoogleDrive, 
  syncDataToGoogleDrive, 
  getLastGoogleDriveSyncTime,
  isGoogleDriveConnected 
} from '../services/googleDriveSync';

/**
 * Безпечне збереження в LocalStorage з захистом від QuotaExceededError.
 * Якщо ліміт пам'яті вичерпано (через фото або історію), очищає важкі base64-зображення,
 * гарантуючи, що всі записи про прийоми їжі, калорії та БЖВ залишаться збереженими на диску!
 */
export function safeSaveToLocalStorage(key: string, data: any): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err: any) {
    console.warn(`[SportMaster Storage] Помилка квоти пам'яті для ${key}. Запускаємо оптимізацію...`, err);
    try {
      if (typeof data === 'object' && data !== null) {
        const cleaned = JSON.parse(JSON.stringify(data));
        // Очищаємо важкі base64 дані з photoUrl, зберігаючи всі поживні речовини та назви
        for (const date in cleaned) {
          if (cleaned[date]?.meals && Array.isArray(cleaned[date].meals)) {
            cleaned[date].meals = cleaned[date].meals.map((m: any) => ({
              ...m,
              photoUrl: undefined
            }));
          }
        }
        localStorage.setItem(key, JSON.stringify(cleaned));
        console.info(`[SportMaster Storage] Дані ${key} успішно врятовано та збережено без важких фото.`);
        return true;
      }
    } catch (cleanErr) {
      console.error('[SportMaster Storage] Критична помилка збереження в LocalStorage:', cleanErr);
    }
    return false;
  }
}

/**
 * Глибоке об'єднання записів днів (Local + Cloud).
 * Жоден прийом їжі ніколи не видаляється і не затирається фоновим завантаженням!
 */
export function mergeDaysLogs(
  localDays: Record<string, DayLog> = {},
  cloudDays: Record<string, DayLog> = {}
): Record<string, DayLog> {
  const merged: Record<string, DayLog> = { ...cloudDays, ...localDays };
  const allDateKeys = new Set([...Object.keys(localDays || {}), ...Object.keys(cloudDays || {})]);

  for (const dateKey of allDateKeys) {
    const local = localDays?.[dateKey];
    const cloud = cloudDays?.[dateKey];

    if (local && cloud) {
      // Об'єднуємо прийоми їжі за унікальним ID
      const mealsMap = new Map<string, FoodEntry>();
      // Спочатку хмарні
      (cloud.meals || []).forEach((m) => {
        if (m && m.id) mealsMap.set(m.id, m);
      });
      // Потім локальні (локальні мають вищий пріоритет)
      (local.meals || []).forEach((m) => {
        if (m && m.id) mealsMap.set(m.id, m);
      });

      merged[dateKey] = {
        date: dateKey,
        meals: Array.from(mealsMap.values()),
        waterMl: Math.max(local.waterMl || 0, cloud.waterMl || 0),
        steps: Math.max(local.steps || 0, cloud.steps || 0),
        weight: local.weight || cloud.weight,
        notes: local.notes || cloud.notes
      };
    } else if (local) {
      merged[dateKey] = local;
    } else if (cloud) {
      merged[dateKey] = cloud;
    }
  }

  return merged;
}

const getDefaultProfile = (user?: AuthUser | null): UserProfile => {
  const initialTargets = calculateNutritionTargets('male', 26, 75, 178, 'moderate', 'lose_weight');
  return {
    name: user?.displayName || 'Користувач',
    email: user?.email || '',
    avatar: user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    gender: 'male',
    age: 26,
    weight: 75,
    height: 178,
    targetWeight: 72,
    activityLevel: 'moderate',
    goal: 'lose_weight',
    calculatedTargets: initialTargets,
    geminiApiKey: '', // Користувач вводить свій особистий ключ Gemini самостійно
    isOnboarded: false,
    isGoogleConnected: user?.provider === 'google'
  };
};

export function useAppData(currentUser: AuthUser | null) {
  const uid = currentUser?.uid || 'guest';
  const profileKey = `sportmaster_u_${uid}_profile`;
  const daysKey = `sportmaster_u_${uid}_days`;
  const chatKey = `sportmaster_u_${uid}_chat`;

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(profileKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load profile', e);
    }
    return getDefaultProfile(currentUser);
  });

  const [days, setDays] = useState<Record<string, DayLog>>(() => {
    try {
      const saved = localStorage.getItem(daysKey);
      if (saved) return JSON.parse(saved);
      // Якщо даних для акаунта ще немає, перевіримо гостьові записи
      if (currentUser && currentUser.uid !== 'guest') {
        const guestSaved = localStorage.getItem('sportmaster_u_guest_days');
        if (guestSaved) {
          const parsedGuest = JSON.parse(guestSaved);
          if (Object.keys(parsedGuest).length > 0) return parsedGuest;
        }
      }
    } catch (e) {
      console.error('Failed to load days', e);
    }
    return {};
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(chatKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load chat', e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Привіт, ${currentUser?.displayName || 'Спортсмене'}! Я твій персональний ШІ-нутриціолог та фітнес-коуч на базі Gemini ⚡. Я готовий аналізувати твоє харчування, підбирати страви під твої цілі та відповідати на будь-які питання про здоров'я. Як справи сьогодні?`,
        timestamp: new Date().toISOString()
      }
    ];
  });

  const [currentDate, setCurrentDate] = useState<string>(getTodayKey());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastGoogleSync, setLastGoogleSync] = useState<string | null>(() => getLastGoogleDriveSyncTime());
  const syncTimeoutRef = useRef<any>(null);

  // Reload data when user changes
  useEffect(() => {
    if (!currentUser) return;

    try {
      const savedProfile = localStorage.getItem(`sportmaster_u_${currentUser.uid}_profile`);
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      } else {
        const def = getDefaultProfile(currentUser);
        setProfile(def);
      }

      const userDaysKey = `sportmaster_u_${currentUser.uid}_days`;
      const savedDays = localStorage.getItem(userDaysKey);
      if (savedDays) {
        setDays(JSON.parse(savedDays));
      } else {
        // Якщо для нового входу немає днів, мігруємо локальні гостьові дні
        const guestDays = localStorage.getItem('sportmaster_u_guest_days');
        if (guestDays) {
          try {
            const parsedGuest = JSON.parse(guestDays);
            if (Object.keys(parsedGuest).length > 0) {
              setDays(parsedGuest);
              safeSaveToLocalStorage(userDaysKey, parsedGuest);
            } else {
              setDays({});
            }
          } catch {
            setDays({});
          }
        } else {
          setDays({});
        }
      }

      const savedChat = localStorage.getItem(`sportmaster_u_${currentUser.uid}_chat`);
      if (savedChat) {
        setChatHistory(JSON.parse(savedChat));
      }
    } catch (e) {
      console.error('Failed to switch user data', e);
    }

    // Background load from Google Drive if signed in with Google
    if (currentUser.provider === 'google') {
      loadDataFromGoogleDrive().then((cloudData) => {
        if (cloudData) {
          if (cloudData.profile) {
            setProfile((prev) => ({
              ...cloudData.profile,
              geminiApiKey: prev.geminiApiKey || cloudData.profile.geminiApiKey || ''
            }));
          }
          if (cloudData.days) {
            setDays((prev) => {
              const merged = mergeDaysLogs(prev, cloudData.days);
              safeSaveToLocalStorage(`sportmaster_u_${currentUser.uid}_days`, merged);
              return merged;
            });
          }
          if (cloudData.chat && Array.isArray(cloudData.chat) && cloudData.chat.length > 0) {
            setChatHistory(cloudData.chat);
          }
          const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
          setLastGoogleSync(time);
        }
      }).catch((e) => console.warn('Google Drive cloud load error:', e));
    }

    // Try background cloud fetch if Firestore is active
    loadDataFromFirestore(currentUser.uid).then((cloudData) => {
      if (cloudData) {
        if (cloudData.profile) setProfile(cloudData.profile);
        if (cloudData.days) {
          setDays((prev) => {
            const merged = mergeDaysLogs(prev, cloudData.days);
            safeSaveToLocalStorage(`sportmaster_u_${currentUser.uid}_days`, merged);
            return merged;
          });
        }
        if (cloudData.chat) setChatHistory(cloudData.chat);
      }
    }).catch(() => {});
  }, [currentUser?.uid]);

  // Persist Profile
  useEffect(() => {
    safeSaveToLocalStorage(profileKey, profile);
    triggerCloudSync();
  }, [profile, profileKey]);

  // Persist Days to local storage and sync to cloud
  useEffect(() => {
    safeSaveToLocalStorage(daysKey, days);
    triggerCloudSync();
  }, [days, daysKey]);

  // Persist Chat
  useEffect(() => {
    safeSaveToLocalStorage(chatKey, chatHistory);
  }, [chatHistory, chatKey]);

  // Debounced cloud sync
  const triggerCloudSync = () => {
    if (!currentUser || currentUser.uid === 'guest') return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setIsCloudSyncing(true);

      // 1. Google Drive AppData Sync (Zero backend, ties to Google Account)
      if (currentUser.provider === 'google' && isGoogleDriveConnected()) {
        try {
          const res = await syncDataToGoogleDrive({
            profile,
            days,
            chat: chatHistory
          });
          if (res.success) {
            const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            setLastGoogleSync(time);
          }
        } catch (e) {
          console.warn('Google Drive auto-sync error:', e);
        }
      }

      // 2. Firestore Sync (if user configured Firebase)
      await syncDataToFirestore(currentUser.uid, {
        profile,
        days,
        chat: chatHistory
      });

      setIsCloudSyncing(false);
    }, 2000);
  };

  const currentDayLog: DayLog = days[currentDate] || {
    date: currentDate,
    meals: [],
    waterMl: 0,
    steps: 0,
    weight: profile.weight
  };

  const updateProfile = (partial: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...partial };
      if (
        partial.gender !== undefined ||
        partial.age !== undefined ||
        partial.weight !== undefined ||
        partial.height !== undefined ||
        partial.activityLevel !== undefined ||
        partial.goal !== undefined
      ) {
        updated.calculatedTargets = calculateNutritionTargets(
          updated.gender,
          updated.age,
          updated.weight,
          updated.height,
          updated.activityLevel,
          updated.goal
        );
      }
      return updated;
    });
  };

  const addFoodEntry = (dateKey: string, entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    const newEntry: FoodEntry = {
      ...entry,
      id: 'food_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString()
    };

    setDays((prev) => {
      const existing = prev[dateKey] || {
        date: dateKey,
        meals: [],
        waterMl: 0,
        steps: 0,
        weight: profile.weight
      };
      const updated = {
        ...prev,
        [dateKey]: {
          ...existing,
          meals: [...existing.meals, newEntry]
        }
      };
      // Синхронно фіксуємо в LocalStorage в ту саму мілісекунду!
      safeSaveToLocalStorage(daysKey, updated);
      return updated;
    });

    return newEntry;
  };

  const removeFoodEntry = (dateKey: string, entryId: string) => {
    setDays((prev) => {
      const existing = prev[dateKey];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [dateKey]: {
          ...existing,
          meals: existing.meals.filter((m) => m.id !== entryId)
        }
      };
      safeSaveToLocalStorage(daysKey, updated);
      return updated;
    });
  };

  const addWater = (dateKey: string, deltaMl: number) => {
    setDays((prev) => {
      const existing = prev[dateKey] || {
        date: dateKey,
        meals: [],
        waterMl: 0,
        steps: 0,
        weight: profile.weight
      };
      const updated = {
        ...prev,
        [dateKey]: {
          ...existing,
          waterMl: Math.max(0, (existing.waterMl || 0) + deltaMl)
        }
      };
      safeSaveToLocalStorage(daysKey, updated);
      return updated;
    });
  };

  const setSteps = (dateKey: string, steps: number) => {
    setDays((prev) => {
      const existing = prev[dateKey] || {
        date: dateKey,
        meals: [],
        waterMl: 0,
        steps: 0,
        weight: profile.weight
      };
      const updated = {
        ...prev,
        [dateKey]: {
          ...existing,
          steps: Math.max(0, steps)
        }
      };
      safeSaveToLocalStorage(daysKey, updated);
      return updated;
    });
  };

  const addSteps = (dateKey: string, deltaSteps: number) => {
    setDays((prev) => {
      const existing = prev[dateKey] || {
        date: dateKey,
        meals: [],
        waterMl: 0,
        steps: 0,
        weight: profile.weight
      };
      const updated = {
        ...prev,
        [dateKey]: {
          ...existing,
          steps: Math.max(0, (existing.steps || 0) + deltaSteps)
        }
      };
      safeSaveToLocalStorage(daysKey, updated);
      return updated;
    });
  };

  const addChatMessage = (role: 'user' | 'assistant', content: string) => {
    const msg: ChatMessage = {
      id: 'chat_' + Date.now(),
      role,
      content,
      timestamp: new Date().toISOString()
    };
    setChatHistory((prev) => [...prev, msg]);
    return msg;
  };

  const clearChat = () => {
    setChatHistory([
      {
        id: 'welcome_new',
        role: 'assistant',
        content: 'Чат очищено! Які питання щодо харчування та тренувань маєте зараз?',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const exportData = () => {
    const data = {
      user: currentUser,
      profile,
      days,
      chatHistory,
      version: '2.0.0',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sportmaster-${currentUser?.email || 'backup'}-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.profile) setProfile(data.profile);
      if (data.days) setDays(data.days);
      if (data.chatHistory) setChatHistory(data.chatHistory);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const syncNowWithGoogleDrive = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: 'Увійдіть в акаунт для збереження' };
    }
    setIsCloudSyncing(true);
    const res = await syncDataToGoogleDrive({
      profile,
      days,
      chat: chatHistory
    });
    setIsCloudSyncing(false);
    if (res.success) {
      const timeStr = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      setLastGoogleSync(timeStr);
      return { success: true, message: `Успішно збережено в Google Диск о ${timeStr}` };
    } else {
      return { success: false, message: res.error || 'Помилка збереження' };
    }
  };

  const resetAllData = () => {
    localStorage.removeItem(profileKey);
    localStorage.removeItem(daysKey);
    localStorage.removeItem(chatKey);
    setProfile(getDefaultProfile(currentUser));
    setDays({});
    setChatHistory([]);
  };

  return {
    profile,
    updateProfile,
    days,
    currentDate,
    setCurrentDate,
    currentDayLog,
    addFoodEntry,
    removeFoodEntry,
    addWater,
    setSteps,
    addSteps,
    chatHistory,
    addChatMessage,
    clearChat,
    exportData,
    importData,
    resetAllData,
    isCloudSyncing,
    lastGoogleSync,
    syncNowWithGoogleDrive
  };
}
