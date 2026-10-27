import { ChatMessage, FoodAnalysisResult } from '../types';

const PRIMARY_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

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
 * Validates Gemini API Key with a lightweight ping
 */
export async function testGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'Ключ API порожній або надто короткий' };
  }

  const trimmedKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${trimmedKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Привіт, скажи Ок' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.error?.message || `Помилка ${res.status}: ${res.statusText}`;
      return { valid: false, error: message };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Не вдалося з\'єднатися з серверами Google' };
  }
}

/**
 * Calls Gemini with fallback from 2.0 to 1.5 if needed
 */
async function callGemini(apiKey: string, body: any): Promise<string> {
  const trimmedKey = apiKey.trim();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Помилка Gemini API (${model}): ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Порожня відповідь від моделі');
      return text;
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed, trying next if available:`, err);
      lastError = err;
    }
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
