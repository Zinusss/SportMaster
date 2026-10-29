import React, { useState, useRef } from 'react';
import { X, Sparkles, Camera, Edit3, Loader2, Check, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { FoodEntry, MealType } from '../types';
import { analyzeFoodFromImage, analyzeFoodFromText } from '../services/gemini';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<FoodEntry, 'id' | 'timestamp'>) => void;
  defaultMealType?: MealType;
  geminiApiKey: string;
  onOpenSettings: () => void;
}

/**
 * Стискає фото на льоту перед відправкою в API або збереженням у LocalStorage.
 * Запобігає вильоту через QuotaExceededError (5MB ліміт браузера)
 */
async function compressImageToDataUrl(file: File, maxDim: number = 600, quality: number = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const AddMealModal: React.FC<AddMealModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultMealType = 'breakfast',
  geminiApiKey,
  onOpenSettings
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai_text' | 'ai_photo'>('ai_text');
  const [mealType, setMealType] = useState<MealType>(defaultMealType);

  // Manual fields
  const [name, setName] = useState('');
  const [weightGrams, setWeightGrams] = useState<string>('150');
  const [calories, setCalories] = useState<string>('');
  const [proteins, setProteins] = useState<string>('');
  const [fats, setFats] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');

  // AI Text input
  const [textDescription, setTextDescription] = useState('');
  
  // AI Photo input
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [photoExtraNotes, setPhotoExtraNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading & error state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiAnalysisNotes, setAiAnalysisNotes] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setWeightGrams('150');
    setCalories('');
    setProteins('');
    setFats('');
    setCarbs('');
    setTextDescription('');
    setPhotoPreview(null);
    setAiAnalysisNotes(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSwitchTab = (tab: 'manual' | 'ai_text' | 'ai_photo') => {
    if (tab === 'manual' && !name.trim() && textDescription.trim()) {
      setName(textDescription.trim());
    }
    setActiveTab(tab);
    setErrorMessage(null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Розмір фото не повинен перевищувати 20 МБ');
      return;
    }

    try {
      setIsLoading(true);
      // Стискаємо до компактного base64 (~25-40 КБ), безпечного для LocalStorage та API
      const compressed = await compressImageToDataUrl(file, 640, 0.65);
      setPhotoPreview(compressed);
      setPhotoMimeType('image/jpeg');
      setErrorMessage(null);
    } catch {
      setErrorMessage('Не вдалося обробити фотографію.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiTextAnalyze = async () => {
    if (!textDescription.trim()) {
      setErrorMessage('Будь ласка, напишіть назву та грами страви');
      return;
    }
    if (!geminiApiKey) {
      setErrorMessage('Потрібен Gemini API ключ. Ви можете ввести його в Налаштуваннях або зберегти страву вручну.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await analyzeFoodFromText(textDescription, geminiApiKey);
      setName(result.name || textDescription.trim());
      setWeightGrams(String(result.weightGrams || 150));
      setCalories(String(result.calories || 0));
      setProteins(String(result.proteins || 0));
      setFats(String(result.fats || 0));
      setCarbs(String(result.carbs || 0));
      if (result.explanation) {
        setAiAnalysisNotes(result.explanation);
      }
      setActiveTab('manual');
    } catch (err: any) {
      setErrorMessage(err.message || 'Не вдалося розрахувати через Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiPhotoAnalyze = async () => {
    if (!photoPreview) {
      setErrorMessage('Будь ласка, сфотографуйте або виберіть фото страви');
      return;
    }
    if (!geminiApiKey) {
      setErrorMessage('Потрібен Gemini API ключ. Ви можете внести дані вручну або ввести ключ у Профілі.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await analyzeFoodFromImage(photoPreview, photoMimeType, photoExtraNotes, geminiApiKey);
      setName(result.name || 'Страва з фото');
      setWeightGrams(String(result.weightGrams || 150));
      setCalories(String(result.calories || 0));
      setProteins(String(result.proteins || 0));
      setFats(String(result.fats || 0));
      setCarbs(String(result.carbs || 0));
      if (result.explanation) {
        setAiAnalysisNotes(`ШІ визначив: ${result.explanation}`);
      }
      setActiveTab('manual');
    } catch (err: any) {
      setErrorMessage(err.message || 'Не вдалося розпізнати фото через Gemini Vision.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectManualFromText = () => {
    if (textDescription.trim()) {
      setName(textDescription.trim());
    }
    setErrorMessage(null);
    setActiveTab('manual');
  };

  const handleDirectManualFromPhoto = () => {
    if (!name.trim()) {
      setName('Страва з фото');
    }
    setErrorMessage(null);
    setActiveTab('manual');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const dishName = name.trim() || textDescription.trim();
    if (!dishName) {
      setErrorMessage('Вкажіть назву страви для збереження');
      return;
    }

    const calNum = Math.round(Number(calories) || 0);
    const protNum = Math.round((Number(proteins) || 0) * 10) / 10;
    const fatNum = Math.round((Number(fats) || 0) * 10) / 10;
    const carbNum = Math.round((Number(carbs) || 0) * 10) / 10;
    const weightNum = Number(weightGrams) || 100;

    onSave({
      mealType,
      name: dishName,
      calories: calNum,
      proteins: protNum,
      fats: fatNum,
      carbs: carbNum,
      weightGrams: weightNum,
      source: activeTab === 'manual' 
        ? (aiAnalysisNotes ? (photoPreview ? 'ai_photo' : 'ai_text') : 'manual') 
        : activeTab,
      photoUrl: photoPreview || undefined,
      aiNotes: aiAnalysisNotes || undefined
    });

    handleClose();
  };

  const mealLabels: Record<MealType, string> = {
    breakfast: '🌅 Сніданок',
    lunch: '☀️ Обід',
    dinner: '🌙 Вечеря',
    snack: '🍎 Перекус'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md transition-opacity">
      <div className="w-full sm:max-w-lg bg-[#1C1C1E] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Додати прийом їжі</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-apple-green/20 text-apple-green font-medium">
                КБЖВ
              </span>
            </h2>
            <p className="text-xs text-apple-subtext mt-0.5">Швидке та гарантоване збереження</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Meal Category Selector */}
        <div className="px-5 pt-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {(Object.keys(mealLabels) as MealType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMealType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                mealType === type
                  ? 'bg-apple-green text-black font-semibold shadow-md shadow-apple-green/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {mealLabels[type]}
            </button>
          ))}
        </div>

        {/* 3 Input Method Tabs */}
        <div className="px-5 py-2">
          <div className="grid grid-cols-3 bg-[#121214] p-1 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => handleSwitchTab('ai_text')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'ai_text'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles size={14} />
              <span>ШІ Текст</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('ai_photo')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'ai_photo'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Camera size={14} />
              <span>ШІ Фото</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('manual')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'manual'
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Edit3 size={14} />
              <span>Вручну</span>
            </button>
          </div>
        </div>

        {/* Missing API Key Warning */}
        {!geminiApiKey && (activeTab === 'ai_text' || activeTab === 'ai_photo') && (
          <div className="mx-5 my-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span>Для роботи авто-розрахунку потрібен ключ Gemini. </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="underline font-semibold text-amber-400 hover:text-amber-300 inline-block mr-1"
              >
                Ввести ключ у Профілі →
              </button>
              <span>або </span>
              <button
                type="button"
                onClick={handleDirectManualFromText}
                className="underline font-semibold text-white/90 hover:text-white inline-block"
              >
                зберегти страву вручну →
              </button>
            </div>
          </div>
        )}

        {/* Error Alert with Fast Fallback */}
        {errorMessage && (
          <div className="mx-5 my-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-2 text-xs text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
            {(activeTab === 'ai_text' || activeTab === 'ai_photo') && (
              <button
                type="button"
                onClick={activeTab === 'ai_text' ? handleDirectManualFromText : handleDirectManualFromPhoto}
                className="w-full py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white font-medium text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Внести та зберегти вручну без ШІ</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          
          {/* TAB 1: AI TEXT */}
          {activeTab === 'ai_text' && (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                <label className="text-xs text-white/80 font-medium block">
                  Опишіть страву або продукт
                </label>
                <textarea
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
                  placeholder="Наприклад: Вівсянка 60г з бананом та медом, або Куряче філе 180г з гречкою"
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition resize-none"
                />
                
                {/* Suggestions chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-white/40">Приклади:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Вівсянка 60г з бананом і медом 15г',
                      'Омлет з 3 яєць, помідор, 1 тост',
                      'Протеїновий коктейль на молоці 300мл',
                      'Борщ з яловичиною 350г'
                    ].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setTextDescription(example)}
                        className="text-[11px] bg-white/5 hover:bg-white/10 text-white/70 px-2.5 py-1 rounded-lg transition"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleAiTextAnalyze}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Gemini розраховує калорії та БЖВ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Розрахувати через Gemini AI</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDirectManualFromText}
                  className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 font-medium text-xs flex items-center justify-center gap-1.5 transition border border-white/10"
                >
                  <Edit3 size={14} />
                  <span>Внести вручну (без ШІ)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI PHOTO */}
          {activeTab === 'ai_photo' && (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {!photoPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/20 hover:border-cyan-500/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition group bg-black/20"
                  >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
                      <Camera size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">Сфотографувати або вибрати фото</p>
                      <p className="text-xs text-white/40 mt-1">ШІ Gemini Vision визначить страву, вагу та КБЖВ</p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden max-h-56 bg-black border border-white/10">
                      <img src={photoPreview} alt="Dish preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div>
                      <label className="text-xs text-white/70 block mb-1">
                        Уточнення (необов'язково):
                      </label>
                      <input
                        type="text"
                        value={photoExtraNotes}
                        onChange={(e) => setPhotoExtraNotes(e.target.value)}
                        placeholder="Наприклад: 2 ложки рису або варені яйця"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {photoPreview && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleAiPhotoAnalyze}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Gemini Vision аналізує фото страви...</span>
                      </>
                    ) : (
                      <>
                        <Camera size={18} />
                        <span>Розпізнати та порахувати КБЖВ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectManualFromPhoto}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 font-medium text-xs flex items-center justify-center gap-1.5 transition border border-white/10"
                  >
                    <Edit3 size={14} />
                    <span>Зберегти це фото та ввести вручну</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL ENTRY / REVIEW */}
          {activeTab === 'manual' && (
            <form id="meal-form" onSubmit={handleSubmit} className="space-y-4">
              {aiAnalysisNotes && (
                <div className="p-3 rounded-2xl bg-apple-green/10 border border-apple-green/20 text-xs text-apple-green space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>Розраховано через Gemini AI</span>
                  </div>
                  <p className="text-white/80 leading-relaxed">{aiAnalysisNotes}</p>
                  <p className="text-[11px] text-apple-subtext">Ви можете відкоригувати будь-яке число перед збереженням.</p>
                </div>
              )}

              {/* Photo indicator if attached */}
              {photoPreview && (
                <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10">
                  <img src={photoPreview} alt="Attached" className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="text-white font-medium truncate">Фото додано до запису</p>
                    <p className="text-apple-subtext text-[11px]">Буде відображатися в щоденнику</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Dish Name */}
              <div>
                <label className="text-xs text-white/70 block mb-1">Назва страви або продукту *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Напр. Вівсянка з бананом"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="text-xs text-white/70 block mb-1">Вага порції (грами)</label>
                <input
                  type="number"
                  min="1"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="150"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
                />
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-[11px] font-semibold text-apple-orange uppercase tracking-wider block mb-1">
                    Калорії (ккал) *
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"
                  />
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-[11px] font-semibold text-apple-pink uppercase tracking-wider block mb-1">
                    Білки (г)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={proteins}
                    onChange={(e) => setProteins(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"
                  />
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-[11px] font-semibold text-apple-yellow uppercase tracking-wider block mb-1">
                    Жири (г)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={fats}
                    onChange={(e) => setFats(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"
                  />
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-[11px] font-semibold text-apple-blue uppercase tracking-wider block mb-1">
                    Вуглеводи (г)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}

        </div>

        {/* Footer */}
        {activeTab === 'manual' && (
          <div className="p-5 border-t border-white/10 bg-[#171719] flex gap-3 pb-safe">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition active:scale-[0.98]"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="flex-1 py-3.5 rounded-2xl bg-apple-green text-black font-semibold text-sm hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Check size={18} />
              <span>Зберегти прийом їжі</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
