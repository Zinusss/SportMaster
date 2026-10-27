import React, { useState } from 'react';
import { 
  Key, ShieldCheck, Check, Sparkles, Smartphone, Download, 
  Upload, RotateCcw, ExternalLink, Loader2, AlertCircle, HeartPulse
} from 'lucide-react';
import { ActivityLevel, Gender, Goal, UserProfile } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../utils/nutrition';
import { testGeminiKey } from '../services/gemini';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (partial: Partial<UserProfile>) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => { success: boolean; error?: string };
  onResetData: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onExportData,
  onImportData,
  onResetData
}) => {
  // Local edit states
  const [apiKeyInput, setApiKeyInput] = useState(profile.geminiApiKey || '');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Profile fields
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email || '');
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [age, setAge] = useState(String(profile.age));
  const [weight, setWeight] = useState(String(profile.weight));
  const [height, setHeight] = useState(String(profile.height));
  const [targetWeight, setTargetWeight] = useState(String(profile.targetWeight));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel);
  const [goal, setGoal] = useState<Goal>(profile.goal);

  const [isSavedMetrics, setIsSavedMetrics] = useState(false);

  // Google Login simulation
  const handleGoogleSignIn = () => {
    // Allows user to simulate or set their Google account details
    const userGoogleEmail = prompt('Введіть ваш Google Email для прив\'язки:', profile.email || 'user@gmail.com');
    if (userGoogleEmail) {
      const googleName = userGoogleEmail.split('@')[0];
      const updatedName = googleName.charAt(0).toUpperCase() + googleName.slice(1);
      onUpdateProfile({
        email: userGoogleEmail,
        name: updatedName,
        isGoogleConnected: true,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userGoogleEmail}`
      });
      setEmail(userGoogleEmail);
      setName(updatedName);
    }
  };

  const handleSaveApiKey = () => {
    onUpdateProfile({ geminiApiKey: apiKeyInput.trim() });
    setTestResult({ valid: true, message: 'Ключ збережено в пам\'яті браузера!' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ valid: false, message: 'Введіть ключ перед тестуванням' });
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);

    const res = await testGeminiKey(apiKeyInput.trim());
    setIsTestingKey(false);
    if (res.valid) {
      onUpdateProfile({ geminiApiKey: apiKeyInput.trim() });
      setTestResult({ valid: true, message: 'Ключ валідний! З\'єднання з Gemini успішне ⚡' });
    } else {
      setTestResult({ valid: false, message: res.error || 'Помилка валідації ключа' });
    }
  };

  const handleSaveMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name,
      email,
      gender,
      age: Number(age) || 25,
      weight: Number(weight) || 70,
      height: Number(height) || 175,
      targetWeight: Number(targetWeight) || 70,
      activityLevel,
      goal
    });
    setIsSavedMetrics(true);
    setTimeout(() => setIsSavedMetrics(false), 2500);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = onImportData(content);
      if (res.success) {
        alert('Дані успішно імпортовано!');
      } else {
        alert('Помилка імпорту: ' + res.error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="pb-28 pt-safe max-w-md mx-auto px-4 space-y-5">
      
      {/* Header */}
      <div className="pt-3">
        <h1 className="text-xl font-bold text-white">Профіль & Налаштування</h1>
        <p className="text-xs text-apple-subtext">Google акаунт, Gemini ШІ та параметри тіла</p>
      </div>

      {/* 1. Google Account & Gemini AI Integration (Direct User Requirement) */}
      <div className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Google & Gemini AI
              </h2>
              <span className="text-[11px] text-apple-subtext">Для аналізу страв та чату</span>
            </div>
          </div>
          {profile.geminiApiKey ? (
            <span className="text-xs bg-apple-green/20 text-apple-green px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>Активно</span>
            </span>
          ) : (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full font-semibold">
              Потрібен ключ
            </span>
          )}
        </div>

        {/* Google Account Status */}
        <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1.5 shadow">
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {profile.isGoogleConnected ? profile.email : 'Google акаунт не підключено'}
              </p>
              <p className="text-[10px] text-apple-subtext">
                {profile.isGoogleConnected ? 'Підключено для запитів до AI' : 'Прив\'яжіть свій Google акаунт'}
              </p>
            </div>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl font-medium transition"
          >
            {profile.isGoogleConnected ? 'Змінити' : 'Увійти'}
          </button>
        </div>

        {/* Gemini API Key Input */}
        <div className="space-y-2">
          <label className="text-xs text-white/80 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key size={14} className="text-purple-400" />
              <span>Google Gemini API Key</span>
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
            >
              <span>Отримати ключ безкоштовно</span>
              <ExternalLink size={11} />
            </a>
          </label>

          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-purple-500"
          />

          <p className="text-[10px] text-apple-subtext leading-relaxed">
            Ключ генерується безкоштовно через Google AI Studio з вашого Google акаунту за 10 секунд і зберігається лише на вашому пристрої.
          </p>
        </div>

        {/* Actions row */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveApiKey}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
          >
            Зберегти ключ
          </button>
          <button
            onClick={handleTestApiKey}
            disabled={isTestingKey}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-50 shadow-md shadow-purple-600/30"
          >
            {isTestingKey ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Тестування...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Тест Gemini ⚡</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
              testResult.valid
                ? 'bg-apple-green/15 border border-apple-green/30 text-apple-green'
                : 'bg-red-500/15 border border-red-500/30 text-red-400'
            }`}
          >
            {testResult.valid ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* 2. Body Metrics Form */}
      <form onSubmit={handleSaveMetrics} className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-apple-orange">
            <HeartPulse size={18} />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Параметри тіла & Мета
            </h2>
          </div>
          <span className="text-[11px] text-apple-subtext">Mifflin-St Jeor</span>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-apple-subtext block mb-1">Ваше ім'я</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
          />
        </div>

        {/* Gender Toggle */}
        <div>
          <label className="text-xs text-apple-subtext block mb-1">Стать</label>
          <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                gender === 'male' ? 'bg-apple-blue text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Чоловік 👨
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                gender === 'female' ? 'bg-apple-pink text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Жінка 👩
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-apple-subtext block mb-1">Вік (років)</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
            />
          </div>

          <div>
            <label className="text-xs text-apple-subtext block mb-1">Зріст (см)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
            />
          </div>

          <div>
            <label className="text-xs text-apple-subtext block mb-1">Поточна вага (кг)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
            />
          </div>

          <div>
            <label className="text-xs text-apple-subtext block mb-1">Бажана вага (кг)</label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
            />
          </div>
        </div>

        {/* Goal Selector */}
        <div>
          <label className="text-xs text-apple-subtext block mb-1">Головна мета</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
          >
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <option key={g} value={g} className="bg-neutral-900 text-white">
                {GOAL_LABELS[g].label} ({GOAL_LABELS[g].desc})
              </option>
            ))}
          </select>
        </div>

        {/* Activity Level Selector */}
        <div>
          <label className="text-xs text-apple-subtext block mb-1">Рівень активності</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-orange"
          >
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((act) => (
              <option key={act} value={act} className="bg-neutral-900 text-white">
                {ACTIVITY_LABELS[act].label} — {ACTIVITY_LABELS[act].desc}
              </option>
            ))}
          </select>
        </div>

        {/* Calculated Stats Preview */}
        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 space-y-1">
          <div className="flex justify-between text-xs text-apple-subtext">
            <span>Базовий метаболізм (BMR):</span>
            <span className="text-white font-semibold">{profile.calculatedTargets.bmr} ккал</span>
          </div>
          <div className="flex justify-between text-xs text-apple-subtext">
            <span>Витрата з активністю (TDEE):</span>
            <span className="text-white font-semibold">{profile.calculatedTargets.tdee} ккал</span>
          </div>
          <div className="flex justify-between text-xs text-apple-orange pt-1 border-t border-white/5">
            <span className="font-semibold">Добова ціль калорій:</span>
            <span className="font-bold text-sm">{profile.calculatedTargets.calories} ккал</span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-2xl bg-apple-green text-black font-bold text-xs hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20"
        >
          {isSavedMetrics ? 'Збережено та перераховано! ✓' : 'Зберегти зміни'}
        </button>
      </form>

      {/* 3. iPhone / iOS Web App Guide (Direct User Requirement) */}
      <div className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-cyan-400">
          <Smartphone size={18} />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Як додати на екран iPhone (PWA)
          </h2>
        </div>

        <p className="text-xs text-apple-subtext leading-relaxed">
          Щоб додаток працював як повноцінна програма на весь екран без панелей Safari:
        </p>

        <ol className="space-y-2 text-xs text-white/80">
          <li className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
            <span>Відкрийте це посилання у браузері <strong>Safari</strong> на iPhone</span>
          </li>
          <li className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
            <span>Натисніть кнопку <strong>«Поділитися»</strong> (квадрат зі стрілкою вгору внизу Safari)</span>
          </li>
          <li className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">3</span>
            <span>Прокрутіть список униз і виберіть <strong>«На початковий екран»</strong></span>
          </li>
          <li className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="w-5 h-5 rounded-full bg-apple-green text-black flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
            <span>Натисніть <strong>«Додати»</strong> у верхньому кутку — готово!</span>
          </li>
        </ol>
      </div>

      {/* 4. Backup & Reset */}
      <div className="ios-glass-card rounded-3xl p-5 border border-white/10 shadow-xl space-y-3">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
          Резервне копіювання даних
        </h2>

        <div className="flex gap-2">
          <button
            onClick={onExportData}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Download size={14} />
            <span>Експорт (JSON)</span>
          </button>

          <label className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
            <Upload size={14} />
            <span>Імпорт</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        <button
          onClick={() => {
            if (confirm('Ви впевнені, що хочете скинути всі дані додатку? Це видалить записи та налаштування.')) {
              onResetData();
            }
          }}
          className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
        >
          <RotateCcw size={14} />
          <span>Очистити всі збережені дані</span>
        </button>
      </div>

    </div>
  );
};
