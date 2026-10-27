import React, { useState } from 'react';
import { 
  TrendingDown, TrendingUp, Target, Scale, Award, 
  Flame, Droplets, Footprints
} from 'lucide-react';
import { DayLog, UserProfile } from '../types';
import { GOAL_LABELS } from '../utils/nutrition';

interface AnalyticsViewProps {
  profile: UserProfile;
  days: Record<string, DayLog>;
  onUpdateWeight: (newWeight: number) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  profile,
  days,
  onUpdateWeight
}) => {
  const [newWeightInput, setNewWeightInput] = useState(String(profile.weight));
  const [isSavedWeight, setIsSavedWeight] = useState(false);

  // Compute weight stats
  const weightDiff = Number((profile.weight - profile.targetWeight).toFixed(1));
  const isLoss = profile.goal.includes('loss');

  // Compute last 7 days stats
  const last7DaysKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    last7DaysKeys.push(`${y}-${m}-${day}`);
  }

  const weeklyData = last7DaysKeys.map((key) => {
    const log = days[key];
    const totalCal = log?.meals.reduce((sum, m) => sum + m.calories, 0) || 0;
    const totalSteps = log?.steps || 0;
    const totalWater = log?.waterMl || 0;
    
    const d = new Date(key + 'T00:00:00');
    const dayName = d.toLocaleDateString('uk-UA', { weekday: 'narrow' }).toUpperCase();

    return {
      date: key,
      dayName,
      calories: totalCal,
      steps: totalSteps,
      water: totalWater
    };
  });

  const avgCalories = Math.round(
    weeklyData.reduce((sum, d) => sum + d.calories, 0) / (weeklyData.filter((d) => d.calories > 0).length || 1)
  );

  const avgSteps = Math.round(
    weeklyData.reduce((sum, d) => sum + d.steps, 0) / (weeklyData.filter((d) => d.steps > 0).length || 1)
  );

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(newWeightInput);
    if (!isNaN(w) && w > 30 && w < 300) {
      onUpdateWeight(w);
      setIsSavedWeight(true);
      setTimeout(() => setIsSavedWeight(false), 2000);
    }
  };

  return (
    <div className="pb-28 pt-safe max-w-md mx-auto px-4 space-y-5">
      
      {/* Header */}
      <div className="pt-3">
        <h1 className="text-xl font-bold text-white">Прогрес & Аналітика</h1>
        <p className="text-xs text-apple-subtext">Динаміка ваги, калорій та активності</p>
      </div>

      {/* Goal & Weight Progress Card */}
      <div className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-apple-green">
            <Target size={18} />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Ціль: {GOAL_LABELS[profile.goal]?.label}
            </span>
          </div>
          <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/70">
            {profile.gender === 'male' ? 'Чоловік' : 'Жінка'}, {profile.height} см
          </span>
        </div>

        {/* Big Weight Numbers */}
        <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/5">
          <div>
            <span className="text-[11px] text-apple-subtext block">Поточна вага</span>
            <span className="text-xl font-bold text-white">{profile.weight}</span>
            <span className="text-[10px] text-white/40 block">кг</span>
          </div>

          <div>
            <span className="text-[11px] text-apple-green block">До цілі</span>
            <div className="flex items-center justify-center gap-1">
              {isLoss ? (
                <TrendingDown size={14} className="text-apple-green" />
              ) : (
                <TrendingUp size={14} className="text-apple-blue" />
              )}
              <span className="text-xl font-bold text-white">{Math.abs(weightDiff)}</span>
            </div>
            <span className="text-[10px] text-apple-green/70 block">кг</span>
          </div>

          <div>
            <span className="text-[11px] text-apple-subtext block">Бажана вага</span>
            <span className="text-xl font-bold text-apple-green">{profile.targetWeight}</span>
            <span className="text-[10px] text-white/40 block">кг</span>
          </div>
        </div>

        {/* Update current weight */}
        <form onSubmit={handleSaveWeight} className="pt-1 flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
              <Scale size={16} />
            </div>
            <input
              type="number"
              step="0.1"
              value={newWeightInput}
              onChange={(e) => setNewWeightInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
              placeholder="Оновити поточну вагу (кг)"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-apple-green hover:text-black font-semibold text-xs transition active:scale-95 text-white"
          >
            {isSavedWeight ? 'Збережено! ✓' : 'Оновити'}
          </button>
        </form>
      </div>

      {/* Weekly Calories Bar Chart */}
      <div className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-apple-orange/20 text-apple-orange flex items-center justify-center">
              <Flame size={16} />
            </div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Калорії за 7 днів
            </h2>
          </div>
          <span className="text-xs text-apple-subtext">
            Сер.: <strong className="text-white">{avgCalories}</strong> ккал
          </span>
        </div>

        {/* CSS Bar Chart */}
        <div className="pt-4 flex items-end justify-between h-36 gap-2 border-b border-white/10 pb-2">
          {weeklyData.map((item) => {
            const target = profile.calculatedTargets.calories;
            const heightPct = Math.min(100, Math.round((item.calories / (target * 1.2 || 2500)) * 100));

            return (
              <div key={item.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[9px] text-white/40 opacity-0 group-hover:opacity-100 transition">
                  {item.calories}
                </div>
                <div className="w-full bg-white/5 rounded-t-lg h-full flex items-end justify-center p-0.5">
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      item.calories === 0
                        ? 'bg-transparent'
                        : item.calories > target
                        ? 'bg-apple-orange'
                        : 'bg-apple-green'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-white/60">{item.dayName}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-apple-subtext pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-apple-green" />
            <span>В межах норми</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-apple-orange" />
            <span>Понад норму</span>
          </div>
        </div>
      </div>

      {/* Weekly Summary Cards (Steps & Water) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="ios-glass-card rounded-2xl p-4 border border-white/10 space-y-1.5">
          <div className="flex items-center gap-1.5 text-apple-green">
            <Footprints size={16} />
            <span className="text-xs font-semibold text-white">Сер. кроки</span>
          </div>
          <p className="text-lg font-bold text-white">{avgSteps.toLocaleString('uk-UA')}</p>
          <span className="text-[10px] text-apple-subtext block">
            Ціль: {profile.calculatedTargets.dailyStepsTarget.toLocaleString('uk-UA')} / день
          </span>
        </div>

        <div className="ios-glass-card rounded-2xl p-4 border border-white/10 space-y-1.5">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Droplets size={16} />
            <span className="text-xs font-semibold text-white">Норма води</span>
          </div>
          <p className="text-lg font-bold text-white">{profile.calculatedTargets.waterMl} мл</p>
          <span className="text-[10px] text-apple-subtext block">
            Розраховано на {profile.weight} кг ваги
          </span>
        </div>
      </div>

      {/* Motivation Tip */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-blue-900/30 border border-purple-500/20 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
          <Award size={18} />
        </div>
        <div className="text-xs text-purple-200/90 leading-relaxed">
          <strong className="text-white block font-semibold mb-0.5">Порада від Gemini:</strong>
          Консистентність важливіша за ідеальність. Навіть 80% дотримання щоденного плану КБЖВ приведе вас до цілі за кілька місяців без зривів та стресу!
        </div>
      </div>

    </div>
  );
};
