import { ChatMessage, FoodAnalysisResult } from '../types';

// Список моделей і версій API у порядку пріоритету
const MODEL_CANDIDATES = [
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash-latest' },
  { version: 'v1beta', model: 'gemini-1.5-pro' }
];

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
 * Validates Gemini API Key with a lightweight ping across model candidates
 */
export async function testGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'Ключ API порожній або надто короткий' };
  }

  const trimmedKey = apiKey.trim();
  let lastErrorMessage = '';

  for (const { version, model } of MODEL_CANDIDATES) {
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
        return { valid: true };
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
 * Calls Gemini with automatic fallback across models and API versions
 */
async function callGemini(apiKey: string, body: any): Promise<string> {
  const trimmedKey = apiKey.trim();
  let lastError: any = null;

  for (const { version, model } of MODEL_CANDIDATES) {
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
        throw new Error(msg);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Порожня відповідь від моделі');
      return text;
    } catch (err: any) {
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
Ти — персональний преміум ШІ-нутриціолог, спортивний дієтолог і фітнес-коуч у додатку "SportMaster".
Твоє ім'я — Gemini Sport Coach.
Ти завжди відповідаєш українською мовою, доброзичливо, професійно, структуровано, лаконічно і мотивуюче (використовуй емодзі, списки де доречно).

ДАНІ ПРО КОРИСТУВАЧА ТА ЙОГО ДЕННИЙ ПРОГРЕС:
${userContext}

Враховуй ці дані у відповідях! Наприклад, якщо користувач питає "Що з'їсти на вечерю?", поглянь скільки калорій та білків у нього залишилось на сьогодні, і запропонуй конкретні варіанти страв із приблизними грамами та ккал.
`.trim();

  // Convert history to Gemini format (limit to last 10 messages for performance and speed)
  const recentMessages = history.slice(-10);
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemInstruction }]
    },
    {
      role: 'model',
      parts: [{ text: 'Зрозумів! Я готовий допомагати вам досягати ідеальної фізичної форми та збалансованого харчування.' }]
    },
    ...recentMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: newMessage }]
    }
  ];

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  return await callGemini(apiKey, body);
}
