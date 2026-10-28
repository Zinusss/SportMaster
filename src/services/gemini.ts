import { ChatMessage, FoodAnalysisResult } from '../types';

// Список моделей і версій API у порядку пріоритету
const MODEL_CANDIDATES = [
  { version: 'v1beta', model: 'gemini-2.5-flash' },
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash-latest' },
  { version: 'v1beta', model: 'gemini-1.5-pro' }
];

let activeModelCache: { version: string; model: string } | null = null;

/**
 * Динамічно запитує у Google список доступних моделей для конкретного API-ключа користувача.
 * Це гарантує, що запит піде до реально існуючої моделі та ніколи не видасть 404 Not Found.
 */
async function discoverSupportedModel(apiKey: string): Promise<{ version: string; model: string } | null> {
  if (activeModelCache) return activeModelCache;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
    if (res.ok) {
      const data = await res.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];
      const contentModels = models.filter((m) =>
        m.supportedGenerationMethods?.includes('generateContent')
      );

      const priorityOrder = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro'
      ];

      for (const pref of priorityOrder) {
        const found = contentModels.find((m) => m.name === `models/${pref}` || m.name.endsWith(`/${pref}`));
        if (found) {
          activeModelCache = { version: 'v1beta', model: found.name.replace(/^models\//, '') };
          return activeModelCache;
        }
      }

      // Якщо точних збігів немає, беремо будь-яку доступну модель з родини gemini
      const fallback = contentModels.find((m) => m.name.toLowerCase().includes('gemini'));
      if (fallback) {
        activeModelCache = { version: 'v1beta', model: fallback.name.replace(/^models\//, '') };
        return activeModelCache;
      }
    }
  } catch (e) {
    // У разі збою запиту списку - автоматично використовуємо статичний каскад
  }
  return null;
}

// Clean JSON helper that handles ```json fences and stray characters
function extractJsonFromText(rawText: string): any {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }
  
  // Find opening and closing brackets if there's surrounding chatter
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Validates Gemini API Key with dynamic discovery and ping across model candidates
 */
export async function testGeminiKey(apiKey: string): Promise<{ valid: boolean; modelName?: string; error?: string }> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'Ключ API порожній або надто короткий' };
  }

  const trimmedKey = apiKey.trim();
  let lastErrorMessage = '';

  // 1. Спробуємо динамічно виявити підтримувані моделі для цього ключа
  const discovered = await discoverSupportedModel(trimmedKey);
  const candidates = discovered
    ? [discovered, ...MODEL_CANDIDATES.filter((c) => c.model !== discovered.model)]
    : MODEL_CANDIDATES;

  for (const { version, model } of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      if (res.ok) {
        activeModelCache = { version, model };
        return { valid: true, modelName: model };
      }

      const errData = await res.json().catch(() => ({}));
      lastErrorMessage = errData?.error?.message || `HTTP ${res.status}`;

      // If it's an invalid key (400 / 403), no need to try other models
      if (res.status === 400 && lastErrorMessage.toLowerCase().includes('api_key_invalid')) {
        return { valid: false, error: 'Недійсний Gemini API ключ. Перевірте правильність копіювання.' };
      }
    } catch (e: any) {
      lastErrorMessage = e.message || 'Помилка мережі';
    }
  }

  if (lastErrorMessage.includes('not found') || lastErrorMessage.includes('404')) {
    return {
      valid: false,
      error: 'Модель Gemini не знайдена для цього ключа. Переконайтеся, що ключ створено на https://aistudio.google.com/app/apikey (Google AI Studio) або в Google Cloud увімкнено Generative Language API.'
    };
  }

  return { valid: false, error: lastErrorMessage || 'Не вдалося перевірити ключ Gemini' };
}

/**
 * Calls Gemini with dynamic model discovery and automatic fallback across models and API versions
 */
async function callGemini(apiKey: string, body: any): Promise<string> {
  const trimmedKey = apiKey.trim();
  let lastError: any = null;

  // Динамічно визначаємо робочу модель або беремо з кешу
  const discovered = await discoverSupportedModel(trimmedKey);
  const candidates = discovered
    ? [discovered, ...MODEL_CANDIDATES.filter((c) => c.model !== discovered.model)]
    : MODEL_CANDIDATES;

  for (const { version, model } of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `Помилка Gemini API (${model}): ${res.status}`;

        // Rate limit (429) -> швидка зупинка з дружнім поясненням
        if (res.status === 429 || msg.toLowerCase().includes('resource_exhausted')) {
          throw new Error('Перевищено хвилинний ліміт запитів Gemini (Rate Limit). Зачекайте 15-20 секунд та повторіть запит.');
        }

        // Недійсний ключ (400) -> швидка зупинка
        if (res.status === 400 && msg.toLowerCase().includes('api_key_invalid')) {
          throw new Error('Недійсний Gemini API ключ. Перевірте правильність копіювання ключа в Профілі.');
        }

        throw new Error(msg);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Порожня відповідь від моделі');

      // Запам'ятовуємо успішну модель
      activeModelCache = { version, model };
      return text;
    } catch (err: any) {
      if (
        err.message && 
        (err.message.includes('Rate Limit') || err.message.includes('Недійсний Gemini API ключ'))
      ) {
        throw err;
      }
      console.warn(`Gemini (${model} ${version}) failed, trying next candidate:`, err);
      lastError = err;
    }
  }

  const rawMsg = lastError?.message || '';
  if (rawMsg.includes('not found') || rawMsg.includes('404')) {
    throw new Error(
      'Модель Gemini не активована для вашого ключа. Створіть новий ключ на https://aistudio.google.com/app/apikey (там моделі увімкнені за замовчуванням).'
    );
  }

  throw lastError || new Error('Не вдалося виконати запит до Gemini');
}

/**
 * Analyzes food name and grams from text description
 */
export async function analyzeFoodFromText(textDescription: string, apiKey: string): Promise<FoodAnalysisResult> {
  const prompt = `
Ти — професійний спортивний дієтолог і нутриціолог.
Користувач описав страву: "${textDescription}".

Твоє завдання — детально проаналізувати страву або продукт, оцінити вагу та розрахувати точні значення КБЖВ (Калорії, Білки, Жири, Вуглеводи).
Якщо вага не вказана користувачем чітко, оціни стандартну порцію для цієї страви.

Поверни ТІЛЬКИ валідний JSON у наступному форматі без зайвого тексту:
{
  "name": "Назва страви українською",
  "weightGrams": 250,
  "calories": 320,
  "proteins": 18,
  "fats": 8,
  "carbs": 44,
  "explanation": "Короткий коментар чому саме такі показники",
  "ingredients": [
    {"name": "Інгредієнт 1", "weight": "150г", "calories": 200},
    {"name": "Інгредієнт 2", "weight": "100г", "calories": 120}
  ]
}
Всі числа calories, proteins, fats, carbs, weightGrams мають бути цілими або десятковими числами.
`.trim();

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const responseText = await callGemini(apiKey, body);
  const parsed = extractJsonFromText(responseText);

  return {
    name: parsed.name || textDescription,
    weightGrams: Math.round(Number(parsed.weightGrams) || 100),
    calories: Math.round(Number(parsed.calories) || 0),
    proteins: Math.round(Number(parsed.proteins) || 0),
    fats: Math.round(Number(parsed.fats) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    explanation: parsed.explanation || '',
    ingredients: parsed.ingredients || []
  };
}

/**
 * Analyzes dish from photo using Gemini Vision
 */
export async function analyzeFoodFromImage(
  base64Data: string,
  mimeType: string,
  extraNotes: string,
  apiKey: string
): Promise<FoodAnalysisResult> {
  const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  const prompt = `
Ти — високоточний ШІ-нутриціолог з компьютерним зором.
Подивись на надане фото страви/їжі. ${extraNotes ? `Коментар користувача: "${extraNotes}".` : ''}

Твоє завдання:
1. Визначити, які страви/інгредієнти на фото.
2. Візуально оцінити об'єм/вагу кожної порції у грамах.
3. Розрахувати сумарні Калорії, Білки (г), Жири (г) та Вуглеводи (г).

Поверни ТІЛЬКИ валідний JSON у наступному форматі:
{
  "name": "Зрозуміла назва страви або набору страв українською",
  "weightGrams": 300,
  "calories": 450,
  "proteins": 28,
  "fats": 14,
  "carbs": 52,
  "explanation": "Що розпізнано на фото та як оцінено розмір порції",
  "ingredients": [
    {"name": "Продукт 1", "weight": "200г", "calories": 300},
    {"name": "Продукт 2", "weight": "100г", "calories": 150}
  ]
}
`.trim();

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const responseText = await callGemini(apiKey, body);
  const parsed = extractJsonFromText(responseText);

  return {
    name: parsed.name || 'Розпізнана страва',
    weightGrams: Math.round(Number(parsed.weightGrams) || 200),
    calories: Math.round(Number(parsed.calories) || 0),
    proteins: Math.round(Number(parsed.proteins) || 0),
    fats: Math.round(Number(parsed.fats) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    explanation: parsed.explanation || '',
    ingredients: parsed.ingredients || []
  };
}

/**
 * AI Nutrition & Fitness Coach Chat
 */
export async function sendNutritionChat(
  history: ChatMessage[],
  newMessage: string,
  userContext: string,
  apiKey: string
): Promise<string> {
  const systemInstruction = `
Ти — персональний преміум ШІ-нутриціолог, спортивний дієтолог і фітнес-коуч у додатку "SportMaster AI".
Твоє ім'я — Gemini Sport Coach.
Ти завжди відповідаєш українською мовою, доброзичливо, професійно, структуровано, лаконічно і мотивуюче.

КРИТИЧНО ВАЖЛИВІ ПРАВИЛА:
1. Завжди завершуй думку та речення повністю! Ніколи не обривай відповідь на півслові або на середині речення.
2. Використовуй списки з маркерами (•) або номерами та виділяй головне жирним шрифтом (**жирний текст**).
3. Враховуй актуальні дані користувача та його прогрес на сьогодні (поточну вагу, ціль, спожиті калорії та БЖВ, дефіцит або залишок).
4. Якщо користувач питає пораду щодо їжі, запропонуй конкретні смачні страви з приблизними грамами та калорійністю.

ДАНІ ПРО КОРИСТУВАЧА ТА ЙОГО ДЕННИЙ ПРОГРЕС:
${userContext}
`.trim();

  // Беремо останні повідомлення, відкидаючи системні помилки та статичні привітання
  const recentMessages = history.slice(-10);
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const m of recentMessages) {
    const text = m.content?.trim();
    if (!text) continue;
    // Пропускаємо системні сповіщення про помилки та стартове привітання
    if (
      m.id === 'welcome' ||
      text.includes('Вибачте, виникла помилка') ||
      text.includes('Gemini API')
    ) {
      continue;
    }

    const role: 'user' | 'model' = m.role === 'user' ? 'user' : 'model';

    // Запобігаємо двом підряд повідомленням однієї ролі (вимога Gemini API: чергування user -> model)
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Діалог у Gemini API обов'язково має починатися з черги 'user'
  if (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }

  // Додаємо нове запитання користувача (якщо попередня черга була user — об'єднуємо, інакше додаємо нову)
  const cleanNewMsg = newMessage.trim();
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += `\n\n${cleanNewMsg}`;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: cleanNewMsg }]
    });
  }

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  };

  return await callGemini(apiKey, body);
}
