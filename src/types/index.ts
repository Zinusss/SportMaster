export type Gender = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Goal = 'lose_weight' | 'mild_loss' | 'maintain' | 'mild_gain' | 'gain_weight';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface CalculatedTargets {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  waterMl: number;
  dailyStepsTarget: number;
  bmr: number;
  tdee: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  gender: Gender;
  age: number;
  weight: number; // in kg
  height: number; // in cm
  targetWeight: number; // in kg
  activityLevel: ActivityLevel;
  goal: Goal;
  calculatedTargets: CalculatedTargets;
  geminiApiKey: string;
  isOnboarded: boolean;
  isGoogleConnected: boolean;
}

export interface FoodEntry {
  id: string;
  mealType: MealType;
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  weightGrams: number;
  timestamp: string; // ISO string
  source: 'manual' | 'ai_text' | 'ai_photo';
  photoUrl?: string; // base64 or URL thumbnail
  aiNotes?: string;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  meals: FoodEntry[];
  waterMl: number;
  steps: number;
  weight?: number;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FoodAnalysisResult {
  name: string;
  weightGrams: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  explanation?: string;
  ingredients?: Array<{
    name: string;
    weight: string;
    calories: number;
  }>;
}
