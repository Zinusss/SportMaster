import { ActivityLevel, CalculatedTargets, Gender, Goal } from '../types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // Малорухливий спосіб життя (сидяча робота, мінімум руху)
  light: 1.375,       // Легка активність (тренування 1-3 рази на тиждень)
  moderate: 1.55,     // Помірна активність (тренування 3-5 разів на тиждень)
  active: 1.725,      // Висока активність (інтенсивні тренування 6-7 разів)
  very_active: 1.9    // Дуже висока активність (важка фізична робота + тренування)
};

export const GOAL_MODIFIERS: Record<Goal, number> = {
  lose_weight: 0.80,  // -20% дефіцит (схуднення)
  mild_loss: 0.90,    // -10% легкий дефіцит
  maintain: 1.00,     // Підтримка поточної ваги
  mild_gain: 1.10,    // +10% легкий профіцит
  gain_weight: 1.15   // +15% набір м'язової маси
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Малорухливий', desc: 'Сидяча робота, рідкі прогулянки' },
  light: { label: 'Легка активність', desc: '1-3 тренування на тиждень або 6-8 тис. кроків' },
  moderate: { label: 'Помірна активність', desc: '3-5 тренувань на тиждень, активний ритм' },
  active: { label: 'Висока активність', desc: '6-7 важких тренувань на тиждень' },
  very_active: { label: 'Екстремальна', desc: 'Професійний спорт або важка фізична праця' },
};

export const GOAL_LABELS: Record<Goal, { label: string; desc: string }> = {
  lose_weight: { label: 'Схуднення', desc: 'Зниження ваги за рахунок дефіциту калорій (-20%)' },
  mild_loss: { label: 'Плавне схуднення', desc: 'Комфортний безпечний дефіцит (-10%)' },
  maintain: { label: 'Підтримка форми', desc: 'Збереження поточної ваги та тонусу' },
  mild_gain: { label: 'Сухий набір', desc: 'Плавний набір якісної м\'язової маси (+10%)' },
  gain_weight: { label: 'Набір маси', desc: 'Активний набір маси та сили (+15%)' },
};

/**
 * Calculates BMR, TDEE and Macro recommendations based on Mifflin-St Jeor formula
 */
export function calculateNutritionTargets(
  gender: Gender,
  age: number,
  weight: number,
  height: number,
  activityLevel: ActivityLevel,
  goal: Goal
): CalculatedTargets {
  // Mifflin - St Jeor Equation
  // Men: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + 5
  // Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) - 161
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  bmr = Math.round(bmr);

  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
  const targetCalories = Math.round(tdee * GOAL_MODIFIERS[goal]);

  // Macro calculation:
  // Proteins: 1.8-2.2g per kg body weight for deficit/surplus, 1.6 for maintenance
  let proteinRatio = 1.8;
  if (goal === 'lose_weight' || goal === 'gain_weight') {
    proteinRatio = 2.0;
  } else if (goal === 'maintain') {
    proteinRatio = 1.6;
  }
  const proteins = Math.round(weight * proteinRatio);
  const proteinCalories = proteins * 4;

  // Fats: 0.9g - 1.0g per kg body weight
  const fatRatio = goal === 'lose_weight' ? 0.9 : 1.0;
  const fats = Math.round(weight * fatRatio);
  const fatCalories = fats * 9;

  // Carbs: Remaining calories / 4
  const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
  const carbs = Math.round(remainingCalories / 4);

  // Water: ~35 ml per kg body weight
  const waterMl = Math.round(weight * 35);

  // Daily steps target: standard 10,000 or adjusted for activity
  const stepTarget = activityLevel === 'sedentary' ? 8000 : activityLevel === 'active' || activityLevel === 'very_active' ? 12000 : 10000;

  return {
    calories: targetCalories,
    proteins,
    fats,
    carbs,
    waterMl,
    dailyStepsTarget: stepTarget,
    bmr,
    tdee
  };
}

/**
 * Calculates estimated burned calories from steps
 */
export function calculateStepsCalories(steps: number, weightKg: number = 70): number {
  // Average formula: ~0.04 - 0.05 kcal per step normalized for body weight (70kg standard)
  const caloriesPerStep = 0.04 * (weightKg / 70);
  return Math.round(steps * caloriesPerStep);
}

/**
 * Format date YYYY-MM-DD
 */
export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format friendly Ukrainian date string
 */
export function formatFriendlyDate(dateKey: string): string {
  const today = getTodayKey();
  if (dateKey === today) return 'Сьогодні';

  const d = new Date(dateKey + 'T00:00:00');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().split('T')[0];
  if (dateKey === yKey) return 'Вчора';

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', weekday: 'short' };
  return d.toLocaleDateString('uk-UA', options);
}
