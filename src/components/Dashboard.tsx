import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Droplets, Footprints, 
  Sparkles, Camera, Edit3, Flame, Trophy, Play, Square,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DayLog, MealType, UserProfile } from '../types';
import { calculateStepsCalories, formatFriendlyDate } from '../utils/nutrition';
import { useStepCounter } from '../hooks/useStepCounter';

interface DashboardProps {
  profile: UserProfile;
  currentDate: string;
  onDateChange: (date: string) => void;
  dayLog: DayLog;
  onAddMealClick: (mealType: MealType) => void;
  onRemoveFoodEntry: (dateKey: string, entryId: string) => void;
  onAddWater: (dateKey: string, ml: number) => void;
  onAddSteps: (dateKey: string, steps: number) => void;
  onSetSteps: (dateKey: string, steps: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  currentDate,
  onDateChange,
  dayLog,
  onAddMealClick,
  onRemoveFoodEntry,
  onAddWater,
  onAddSteps,
  onSetSteps
}) => {
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [manualStepsInput, setManualStepsInput] = useState('');

  // Step counter hook
  const { isListening, startListening, stopListening, liveStepCount, error: stepError } = useStepCounter(
    () => {
      onAddSteps(currentDate, 1);
    }
  );

  // Navigate date
  const handleShiftDate = (daysDelta: number) => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + daysDelta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${day}`);
  };

  // Calculations
  const totalCaloriesConsumed = dayLog.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProteinsConsumed = dayLog.meals.reduce((sum, m) => sum + (m.proteins || 0), 0);
  const totalFatsConsumed = dayLog.meals.reduce((sum, m) => sum + (m.fats || 0), 0);
  const totalCarbsConsumed = dayLog.meals.reduce((sum, m) => sum + (m.carbs || 0), 0);

  const targets = profile.calculatedTargets;
  const burnedFromSteps = calculateStepsCalories(dayLog.steps || 0, profile.weight);
  
  // Remaining = Target - Consumed + Burned (or pure deficit)
  const remainingCalories = Math.round(targets.calories - totalCaloriesConsumed + burnedFromSteps);
  const calorieProgressPct = Math.min(100, Math.round((totalCaloriesConsumed / (targets.calories || 2000)) * 100));

  const mealCategories: { type: MealType; title: string; icon: string; time: string }[] = [
    { type: 'breakfast', title: 'Сніданок', icon: '🌅', time: '08:00 - 10:00' },
    { type: 'lunch', title: 'Обід', icon: '☀️', time: '13:00 - 15:00' },
    { type: 'dinner', title: 'Вечеря', icon: '🌙', time: '19:00 - 21:00' },
    { type: 'snack', title: 'Перекуси', icon: '🍎', time: 'Протягом дня' },
  ];

  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="pb-28 pt-safe max-w-md mx-auto px-4 space-y-5">
      
      {/* Top Bar: Profile avatar + Date switcher */}
      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={profile.name}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/10"
            />
            {profile.isGoogleConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5 shadow">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </span>
            )}
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Привіт, {profile.name} 👋</h1>
            <p className="text-xs text-apple-subtext">Ціль: {profile.targetWeight} кг</p>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
          <button
            onClick={() => handleShiftDate(-1)}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[70px] text-center">
            {formatFriendlyDate(currentDate)}
          </span>
          <button
            onClick={() => handleShiftDate(1)}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Calorie Summary Card (Apple Fitness Style) */}
      <div className="ios-glass-card rounded-3xl p-5 relative overflow-hidden shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-apple-orange/20 to-apple-pink/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-apple-orange/20 flex items-center justify-center text-apple-orange">
              <Flame size={18} />
            </div>
            <div>
              <span className="text-xs text-apple-subtext font-medium block">Баланс калорій</span>
              <span className="text-sm font-semibold text-white">
                {remainingCalories >= 0 ? `${remainingCalories} ккал залишилось` : `${Math.abs(remainingCalories)} ккал понад норму`}
              </span>
            </div>
          </div>

          {remainingCalories >= 0 && remainingCalories < 200 && (
            <button
              onClick={handleCelebrate}
              className="text-xs bg-apple-green/20 text-apple-green px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 hover:bg-apple-green/30 transition"
            >
              <Trophy size={13} />
              <span>В цілі!</span>
            </button>
          )}
        </div>

        {/* Big numbers row */}
        <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/5">
          <div>
            <span className="text-[11px] text-apple-subtext block">Ціль</span>
            <span className="text-lg font-bold text-white">{targets.calories}</span>
            <span className="text-[10px] text-white/40 block">ккал</span>
          </div>
          <div>
            <span className="text-[11px] text-apple-orange block">З'їдено</span>
            <span className="text-lg font-bold text-apple-orange">{totalCaloriesConsumed}</span>
            <span className="text-[10px] text-apple-orange/60 block">ккал</span>
          </div>
          <div>
            <span className="text-[11px] text-apple-blue block">Спалено (рух)</span>
            <span className="text-lg font-bold text-apple-blue">+{burnedFromSteps}</span>
            <span className="text-[10px] text-apple-blue/60 block">ккал</span>
          </div>
        </div>

        {/* Progress line */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px] text-apple-subtext">
            <span>Прогрес дня</span>
            <span className="text-white font-medium">{calorieProgressPct}%</span>
          </div>
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalCaloriesConsumed > targets.calories
                  ? 'bg-gradient-to-r from-apple-orange to-red-500'
                  : 'bg-gradient-to-r from-apple-orange to-apple-yellow'
              }`}
              style={{ width: `${Math.min(100, calorieProgressPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* KBJU Macro Rings / Cards (Proteins, Fats, Carbs) */}
      <div className="grid grid-cols-3 gap-2.5">
        
        {/* Proteins */}
        <div className="ios-glass-card rounded-2xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-apple-pink">Білки</span>
            <span className="text-[10px] text-apple-subtext">{Math.round((totalProteinsConsumed / targets.proteins) * 100)}%</span>
          </div>
          <div>
            <span className="text-base font-bold text-white">{Math.round(totalProteinsConsumed)}</span>
            <span className="text-[11px] text-apple-subtext"> / {targets.proteins}г</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-apple-pink h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalProteinsConsumed / targets.proteins) * 100)}%` }}
            />
          </div>
        </div>

        {/* Fats */}
        <div className="ios-glass-card rounded-2xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-apple-yellow">Жири</span>
            <span className="text-[10px] text-apple-subtext">{Math.round((totalFatsConsumed / targets.fats) * 100)}%</span>
          </div>
          <div>
            <span className="text-base font-bold text-white">{Math.round(totalFatsConsumed)}</span>
            <span className="text-[11px] text-apple-subtext"> / {targets.fats}г</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-apple-yellow h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalFatsConsumed / targets.fats) * 100)}%` }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div className="ios-glass-card rounded-2xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-apple-blue">Вуглеводи</span>
            <span className="text-[10px] text-apple-subtext">{Math.round((totalCarbsConsumed / targets.carbs) * 100)}%</span>
          </div>
          <div>
            <span className="text-base font-bold text-white">{Math.round(totalCarbsConsumed)}</span>
            <span className="text-[11px] text-apple-subtext"> / {targets.carbs}г</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-apple-blue h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalCarbsConsumed / targets.carbs) * 100)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Quick Trackers: Water & Steps */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* Water Tracker */}
        <div className="ios-glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Droplets size={16} />
              <span className="text-xs font-semibold text-white">Вода</span>
            </div>
            <span className="text-[11px] text-cyan-400 font-medium">
              {dayLog.waterMl || 0} / {targets.waterMl} мл
            </span>
          </div>

          <div className="my-2.5 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, ((dayLog.waterMl || 0) / targets.waterMl) * 100)}%` }}
            />
          </div>

          <button
            onClick={() => onAddWater(currentDate, 250)}
            className="w-full py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
          >
            <Plus size={14} />
            <span>+250 мл</span>
          </button>
        </div>

        {/* Steps Tracker */}
        <div className="ios-glass-card rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-apple-green">
              <Footprints size={16} />
              <span className="text-xs font-semibold text-white">Кроки</span>
            </div>
            <span className="text-[11px] text-apple-green font-medium">
              {dayLog.steps || 0} / {targets.dailyStepsTarget}
            </span>
          </div>

          <div className="my-2.5 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-apple-green h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, ((dayLog.steps || 0) / targets.dailyStepsTarget) * 100)}%` }}
            />
          </div>

          <button
            onClick={() => setShowStepsModal(true)}
            className="w-full py-1.5 rounded-xl bg-apple-green/15 hover:bg-apple-green/25 text-apple-green text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
          >
            <span>Налаштувати кроки</span>
          </button>
        </div>

      </div>

      {/* Meals Section (User's Core Requirement) */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-apple-subtext">
            Прийоми їжі за день
          </h2>
          <span className="text-xs text-white/50">{dayLog.meals.length} страв</span>
        </div>

        <div className="space-y-3">
          {mealCategories.map((cat) => {
            const mealsInCat = dayLog.meals.filter((m) => m.mealType === cat.type);
            const catCalories = mealsInCat.reduce((sum, m) => sum + m.calories, 0);

            return (
              <div
                key={cat.type}
                className="ios-glass-card rounded-3xl p-4 border border-white/10 space-y-3"
              >
                {/* Meal header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{cat.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{cat.title}</h3>
                      <span className="text-[10px] text-apple-subtext">{cat.time}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-apple-orange">
                      {catCalories} ккал
                    </span>
                    <button
                      onClick={() => onAddMealClick(cat.type)}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-apple-green hover:text-black flex items-center justify-center text-white/80 transition active:scale-90"
                      title="Додати страву"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Meals list */}
                {mealsInCat.length === 0 ? (
                  <button
                    onClick={() => onAddMealClick(cat.type)}
                    className="w-full py-3 border border-dashed border-white/10 rounded-2xl text-xs text-white/40 hover:text-white/70 hover:border-white/20 flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus size={14} />
                    <span>Додати їжу (вручну, описом або фото)</span>
                  </button>
                ) : (
                  <div className="space-y-2 pt-1">
                    {mealsInCat.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 group"
                      >
                        {/* Food info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {entry.photoUrl ? (
                            <img
                              src={entry.photoUrl}
                              alt={entry.name}
                              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 shrink-0">
                              {entry.source === 'ai_text' ? (
                                <Sparkles size={16} className="text-purple-400" />
                              ) : entry.source === 'ai_photo' ? (
                                <Camera size={16} className="text-cyan-400" />
                              ) : (
                                <Edit3 size={15} className="text-white/40" />
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{entry.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-apple-subtext mt-0.5">
                              <span>{entry.weightGrams}г</span>
                              <span>•</span>
                              <span>Б: {entry.proteins}г</span>
                              <span>Ж: {entry.fats}г</span>
                              <span>В: {entry.carbs}г</span>
                            </div>
                          </div>
                        </div>

                        {/* Calories & Delete action */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-white">{entry.calories} ккал</span>
                          <button
                            onClick={() => onRemoveFoodEntry(currentDate, entry.id)}
                            className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition"
                            title="Видалити"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Steps Counter Details Modal */}
      {showStepsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-md bg-[#1C1C1E] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-apple-green">
                <Footprints size={20} />
                <h3 className="text-base font-bold text-white">Крокомір та спалені калорії</h3>
              </div>
              <button
                onClick={() => setShowStepsModal(false)}
                className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/70 hover:text-white"
              >
                Закрити
              </button>
            </div>

            {/* Current summary */}
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
              <div>
                <span className="text-xs text-apple-subtext block">Пройдено сьогодні</span>
                <span className="text-2xl font-bold text-white">{dayLog.steps || 0}</span>
                <span className="text-xs text-apple-subtext"> з {targets.dailyStepsTarget} кроків</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-apple-blue block">Спалено енергії</span>
                <span className="text-2xl font-bold text-apple-blue">~{burnedFromSteps}</span>
                <span className="text-xs text-apple-blue/70 block">ккал</span>
              </div>
            </div>

            {/* Live Accelerometer Counter */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Живий крокомір через сенсор руху</span>
                  </h4>
                  <p className="text-[11px] text-apple-subtext mt-0.5">
                    Працює в реальному часі через акселерометр телефону під час ходьби.
                  </p>
                </div>
              </div>

              {stepError && (
                <p className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded-xl">
                  {stepError}
                </p>
              )}

              <div className="flex gap-2">
                {!isListening ? (
                  <button
                    onClick={startListening}
                    className="flex-1 py-2.5 rounded-xl bg-apple-green text-black font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-apple-green/20 hover:bg-apple-green/90 transition"
                  >
                    <Play size={14} />
                    <span>Увімкнути сенсор ходьби</span>
                  </button>
                ) : (
                  <button
                    onClick={stopListening}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-red-500/30 transition animate-pulse"
                  >
                    <Square size={14} />
                    <span>Зупинити сенсор ({liveStepCount} за сесію)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick add buttons */}
            <div className="space-y-2">
              <span className="text-xs text-white/70 block font-medium">Швидке додавання кроків:</span>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 3000].map((num) => (
                  <button
                    key={num}
                    onClick={() => onAddSteps(currentDate, num)}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/90 transition"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual exact input */}
            <div className="pt-2 border-t border-white/10 flex gap-2">
              <input
                type="number"
                placeholder="Введіть точне число кроків..."
                value={manualStepsInput}
                onChange={(e) => setManualStepsInput(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
              />
              <button
                onClick={() => {
                  const val = parseInt(manualStepsInput, 10);
                  if (!isNaN(val)) {
                    onSetSteps(currentDate, val);
                    setManualStepsInput('');
                    setShowStepsModal(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-apple-green text-black text-xs font-bold hover:bg-apple-green/90 transition"
              >
                Встановити
              </button>
            </div>

            <div className="text-[11px] text-white/40 flex items-start gap-1.5 leading-relaxed">
              <HelpCircle size={14} className="shrink-0 mt-0.5 text-white/30" />
              <span>
                Підказка для iPhone: Web-браузери iOS обмежують роботу датчиків руху, коли екран вимкнено або вкладка згорнута. Тому ви також можете просто переглянути кроки у додатку Apple «Здоров'я» або Apple Watch та внести сюди за секунду!
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
