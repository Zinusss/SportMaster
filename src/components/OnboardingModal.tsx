import React, { useState } from 'react';
import { 
  Sparkles, Check, ArrowRight, ArrowLeft, Trophy, ExternalLink, ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ActivityLevel, Gender, Goal, UserProfile } from '../types';
import { ACTIVITY_LABELS, calculateNutritionTargets, GOAL_LABELS } from '../utils/nutrition';
import { testGeminiKey } from '../services/gemini';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (profileData: Partial<UserProfile>) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete
}) => {
  const [step, setStep] = useState<number>(1);

  // Step 1: Google & AI Key
  const [googleEmail, setGoogleEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  // Step 2: Body Metrics
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(178);
  const [weight, setWeight] = useState<number>(76);
  const [targetWeight, setTargetWeight] = useState<number>(72);

  // Step 3: Activity & Goal
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('lose_weight');

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setIsValidatingKey(true);
    const res = await testGeminiKey(apiKey.trim());
    setIsValidatingKey(false);
    setIsKeyValid(res.valid);
  };

  const calculated = calculateNutritionTargets(gender, age, weight, height, activityLevel, goal);

  const handleNext = () => {
    if (step === 3) {
      // Trigger celebratory confetti on reveal of personalized target
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 }
      });
    }
    setStep((s) => s + 1);
  };

  const handleFinish = () => {
    onComplete({
      name: userName.trim() || (googleEmail ? googleEmail.split('@')[0] : 'Спортсмен'),
      email: googleEmail.trim(),
      avatar: googleEmail
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${googleEmail}`
        : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isGoogleConnected: !!googleEmail,
      geminiApiKey: apiKey.trim(),
      gender,
      age,
      height,
      weight,
      targetWeight,
      activityLevel,
      goal,
      calculatedTargets: calculated,
      isOnboarded: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Step Progress Indicators */}
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-apple-green' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Google Account & Gemini AI */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-600/30">
                <Sparkles size={24} />
              </div>
              <h2 className="text-lg font-bold text-white pt-2">Вхід через Google & Gemini ШІ</h2>
              <p className="text-xs text-apple-subtext">
                Ваш Google акаунт потрібен для безкоштовних запитів до ШІ Gemini (розпізнавання страв, підрахунок КБЖВ і коуч-чат).
              </p>
            </div>

            {/* Google Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/80 font-medium block">Ваш Google Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-3.5 pr-10 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
                <div className="absolute right-3 top-3 w-5 h-5">
                  <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/80 font-medium block">Як до вас звертатися?</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ваше ім'я"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-3.5 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Gemini API Key */}
            <div className="space-y-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/80 font-medium">Gemini API Ключ</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
                >
                  <span>Отримати в Google Studio</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setIsKeyValid(null);
                  }}
                  placeholder="Вставте ключ AIzaSy... (можна пізніше)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-purple-500"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isValidatingKey}
                    className="px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-xs font-medium transition"
                  >
                    {isValidatingKey ? '...' : 'Тест'}
                  </button>
                )}
              </div>
              {isKeyValid === true && (
                <p className="text-[11px] text-apple-green flex items-center gap-1">
                  <ShieldCheck size={13} />
                  <span>Ключ успішно перевірено!</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Body Metrics */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">Параметри тіла</h2>
              <p className="text-xs text-apple-subtext">
                Для точного розрахунку базального метаболізму за формулою Mifflin-St Jeor.
              </p>
            </div>

            {/* Gender */}
            <div>
              <label className="text-xs text-apple-subtext block mb-1">Стать</label>
              <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2 rounded-lg text-xs font-semibold transition ${
                    gender === 'male' ? 'bg-apple-blue text-white shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Чоловік 👨
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2 rounded-lg text-xs font-semibold transition ${
                    gender === 'female' ? 'bg-apple-pink text-white shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Жінка 👩
                </button>
              </div>
            </div>

            {/* Age & Height */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-apple-subtext block mb-1">Вік (років)</label>
                <input
                  type="number"
                  min="12"
                  max="100"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-apple-green"
                />
              </div>
              <div>
                <label className="text-xs text-apple-subtext block mb-1">Зріст (см)</label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-apple-green"
                />
              </div>
            </div>

            {/* Weight & Target Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-apple-subtext block mb-1">Поточна вага (кг)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="250"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-apple-green"
                />
              </div>
              <div>
                <label className="text-xs text-apple-subtext block mb-1">Бажана вага (кг)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="250"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-apple-green"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Activity & Goal */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">Активність & Ціль</h2>
              <p className="text-xs text-apple-subtext">
                Визначимо витрати калорій і дефіцит/профіцит
              </p>
            </div>

            {/* Goal */}
            <div className="space-y-1.5">
              <label className="text-xs text-apple-subtext block">Ваша мета:</label>
              <div className="space-y-1.5">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs transition-all ${
                      goal === g
                        ? 'border-apple-green bg-apple-green/10 text-white font-medium'
                        : 'border-white/5 bg-black/30 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <div className="font-semibold text-white">{GOAL_LABELS[g].label}</div>
                    <div className="text-[10px] text-apple-subtext mt-0.5">{GOAL_LABELS[g].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs text-apple-subtext block">Рівень щоденного навантаження:</label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-apple-green"
              >
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((act) => (
                  <option key={act} value={act} className="bg-neutral-900 text-white">
                    {ACTIVITY_LABELS[act].label} — {ACTIVITY_LABELS[act].desc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 4: Calculated Plan Reveal */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-apple-green/20 text-apple-green flex items-center justify-center mx-auto">
                <Trophy size={24} />
              </div>
              <h2 className="text-lg font-bold text-white pt-2">Ваш персональний план готовий!</h2>
              <p className="text-xs text-apple-subtext">
                Алгоритм розрахував добову норму КБЖВ спеціально під ваше тіло:
              </p>
            </div>

            {/* Big Target Calorie Card */}
            <div className="bg-gradient-to-br from-apple-orange/20 to-apple-pink/20 border border-apple-orange/30 rounded-3xl p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-apple-orange uppercase tracking-wider block">
                Добова норма калорій
              </span>
              <span className="text-3xl font-extrabold text-white">{calculated.calories}</span>
              <span className="text-xs text-white/60 block">ккал на день</span>
            </div>

            {/* Macro distribution grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-apple-pink font-semibold block">Білки</span>
                <span className="text-base font-bold text-white">{calculated.proteins}г</span>
                <span className="text-[10px] text-white/40 block">м'язи & тонус</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-apple-yellow font-semibold block">Жири</span>
                <span className="text-base font-bold text-white">{calculated.fats}г</span>
                <span className="text-[10px] text-white/40 block">гормони & енергія</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-apple-blue font-semibold block">Вуглеводи</span>
                <span className="text-base font-bold text-white">{calculated.carbs}г</span>
                <span className="text-[10px] text-white/40 block">витривалість</span>
              </div>
            </div>

            {/* Water & Steps */}
            <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5 text-xs">
              <span className="text-cyan-400">💧 Вода: {calculated.waterMl} мл</span>
              <span className="text-apple-green">👟 Кроки: {calculated.dailyStepsTarget.toLocaleString('uk-UA')}</span>
            </div>
          </div>
        )}

        {/* Buttons Nav */}
        <div className="flex items-center gap-3 pt-2">
          {step > 1 && step < 4 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-apple-green to-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-apple-green/20 hover:opacity-95 transition"
            >
              <span>Далі</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3.5 rounded-2xl bg-apple-green text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-apple-green/30 hover:opacity-95 transition"
            >
              <Check size={18} />
              <span>Почати відстеження</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
