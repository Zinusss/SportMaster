import { useState, useEffect, useRef } from 'react';
import { ChatMessage, DayLog, FoodEntry, UserProfile } from '../types';
import { AuthUser } from '../types/auth';
import { calculateNutritionTargets, getTodayKey } from '../utils/nutrition';
import { loadDataFromFirestore, syncDataToFirestore } from '../services/firebase';

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

      const savedDays = localStorage.getItem(`sportmaster_u_${currentUser.uid}_days`);
      if (savedDays) {
        setDays(JSON.parse(savedDays));
      } else {
        setDays({});
      }

      const savedChat = localStorage.getItem(`sportmaster_u_${currentUser.uid}_chat`);
      if (savedChat) {
        setChatHistory(JSON.parse(savedChat));
      }
    } catch (e) {
      console.error('Failed to switch user data', e);
    }

    // Try background cloud fetch if Firestore is active
    loadDataFromFirestore(currentUser.uid).then((cloudData) => {
      if (cloudData) {
        if (cloudData.profile) setProfile(cloudData.profile);
        if (cloudData.days) setDays(cloudData.days);
        if (cloudData.chat) setChatHistory(cloudData.chat);
      }
    }).catch(() => {});
  }, [currentUser?.uid]);

  // Persist Profile
  useEffect(() => {
    try {
      localStorage.setItem(profileKey, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
    triggerCloudSync();
  }, [profile, profileKey]);

  // Persist Days
  useEffect(() => {
    try {
      localStorage.setItem(daysKey, JSON.stringify(days));
    } catch (e) {
      console.error('Failed to save days', e);
    }
    triggerCloudSync();
  }, [days, daysKey]);

  // Persist Chat
  useEffect(() => {
    try {
      localStorage.setItem(chatKey, JSON.stringify(chatHistory));
    } catch (e) {
      console.error('Failed to save chat', e);
    }
  }, [chatHistory, chatKey]);

  // Debounced cloud sync
  const triggerCloudSync = () => {
    if (!currentUser || currentUser.uid === 'guest') return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setIsCloudSyncing(true);
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
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          meals: [...existing.meals, newEntry]
        }
      };
    });

    return newEntry;
  };

  const removeFoodEntry = (dateKey: string, entryId: string) => {
    setDays((prev) => {
      const existing = prev[dateKey];
      if (!existing) return prev;
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          meals: existing.meals.filter((m) => m.id !== entryId)
        }
      };
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
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          waterMl: Math.max(0, (existing.waterMl || 0) + deltaMl)
        }
      };
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
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          steps: Math.max(0, steps)
        }
      };
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
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          steps: Math.max(0, (existing.steps || 0) + deltaSteps)
        }
      };
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
    isCloudSyncing
  };
}
