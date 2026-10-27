import { useState, useEffect } from 'react';
import { ChatMessage, DayLog, FoodEntry, UserProfile } from '../types';
import { calculateNutritionTargets, getTodayKey } from '../utils/nutrition';

const STORAGE_KEYS = {
  PROFILE: 'sportmaster_profile_v1',
  DAYS: 'sportmaster_days_v1',
  CHAT: 'sportmaster_chat_v1',
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Користувач',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  gender: 'male',
  age: 26,
  weight: 75,
  height: 178,
  targetWeight: 72,
  activityLevel: 'moderate',
  goal: 'lose_weight',
  calculatedTargets: calculateNutritionTargets('male', 26, 75, 178, 'moderate', 'lose_weight'),
  geminiApiKey: '',
  isOnboarded: false,
  isGoogleConnected: false,
};

export function useAppData() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load profile from localStorage', e);
    }
    return DEFAULT_PROFILE;
  });

  const [days, setDays] = useState<Record<string, DayLog>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAYS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load days from localStorage', e);
    }
    return {};
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHAT);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load chat from localStorage', e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Привіт! Я твій персональний ШІ-нутриціолог та фітнес-коуч на базі Gemini ⚡. Я готовий аналізувати твоє харчування, підбирати страви під твої цілі та відповідати на будь-які питання про тренування й здоров\'я. Як ти почуваєшся сьогодні?',
        timestamp: new Date().toISOString()
      }
    ];
  });

  const [currentDate, setCurrentDate] = useState<string>(getTodayKey());

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DAYS, JSON.stringify(days));
    } catch (e) {
      console.error('Failed to save days', e);
    }
  }, [days]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatHistory));
    } catch (e) {
      console.error('Failed to save chat', e);
    }
  }, [chatHistory]);

  // Current day data accessor
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
      // Recalculate targets if body metrics changed
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
      const newWater = Math.max(0, (existing.waterMl || 0) + deltaMl);
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          waterMl: newWater
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
        content: 'Чат очищено! Чим можу допомогти зараз?',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const exportData = () => {
    const data = {
      profile,
      days,
      chatHistory,
      version: '1.0.0',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sportmaster-backup-${getTodayKey()}.json`;
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
    localStorage.clear();
    setProfile(DEFAULT_PROFILE);
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
    resetAllData
  };
}
