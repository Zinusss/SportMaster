import { ChatMessage, FoodAnalysisResult } from '../types';

// Список моделей і версій API у порядку пріоритету (спочатку моделі з найвищою квотою 15 RPM / 1500 RPD)
const MODEL_CANDIDATES = [
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash-8b' },
  { version: 'v1', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-2.0-flash-lite-preview-02-05' },
  { version: 'v1beta', model: 'gemini-1.5-pro' },
  { version: 'v1beta', model: 'gemini-2.5-flash' }
];

let activeModelCache: { version: string; model: string } | null = null;

/**
 * Динамічно запитує у Google список доступних моделей для конкретного API-ключа користувача.
 * Пріоритет віддається стабільним моделям з максимальною квотою запитів (15 RPM).
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
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash-8b',
        'gemini-2.0-flash-lite-preview-02-05',
        'gemini-1.5-pro',
        'gemini-2.5-flash',
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
  let rateLimitCount = 0;

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

      // Якщо модель перевантажена (429) — не зупиняємось, пробуємо іншу модель
      if (res.status === 429 || lastErrorMessage.toLowerCase().includes('resource_exhausted')) {
        rateLimitCount++;
        continue;
      }

      // If it's an invalid key (400 / 403), no need to try other models
      if (res.status === 400 && lastErrorMessage.toLowerCase().includes('api_key_invalid')) {
        return { valid: false, error: 'Недійсний Gemini API ключ. Перевірте правильність копіювання.' };
      }
    } catch (e: any) {
      lastErrorMessage = e.message || 'Помилка мережі';
    }
  }

  if (rateLimitCount > 0 && rateLimitCount >= candidates.length) {
    return {
      valid: false,
      error: 'Ключ дійсний, але досягнуто тимчасового ліміту запитів Google (Rate Limit). Зачекайте 20 секунд.'
    };
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
 * Calls Gemini with dynamic model discovery and AUTOMATIC MODEL SWAPPING on rate limits (429)
 */
async function callGemini(apiKey: string, body: any): Promise<string> {
  const trimmedKey = apiKey.trim();
  let lastError: any = null;
  const rateLimitedModels: string[] = [];

  // Динамічно визначаємо список моделей, ставлячи активну першою
  const discovered = await discoverSupportedModel(trimmedKey);
  let candidates = [...MODEL_CANDIDATES];
  if (discovered) {
    candidates = [
      discovered,
      ...MODEL_CANDIDATES.filter((c) => c.model !== discovered.model || c.version !== discovered.version)
    ];
  }

  for (let i = 0; i < candidates.length; i++) {
    const { version, model } = candidates[i];
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

        // Rate limit (429 / RESOURCE_EXHAUSTED / quota exceeded) -> АВТОМАТИЧНИЙ СВАП МОДЕЛІ!
        if (
          res.status === 429 || 
          msg.toLowerCase().includes('resource_exhausted') || 
          msg.toLowerCase().includes('quota')
        ) {
          rateLimitedModels.push(model);
          console.warn(
            `[SportMaster AI] Модель ${model} досягла ліміту (429). Автоматично свапаємо на наступну модель у списку...`
          );
          // Скидаємо закешовану модель, щоб вона не блокувала наступні виклики
          activeModelCache = null;
          lastError = new Error(`Ліміт вичерпано на моделі ${model}`);
          // Переходимо до наступної моделі в циклі!
          continue;
        }

        // Недійсний ключ (400) -> тут свапати немає сенсу, ключ хибний
        if (res.status === 400 && msg.toLowerCase().includes('api_key_invalid')) {
          throw new Error('Недійсний Gemini API ключ. Перевірте правильність копіювання ключа в Профілі.');
        }

        throw new Error(msg);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Порожня відповідь від моделі');

      // Успішно! Запам'ятовуємо працюючу модель на сесію
      activeModelCache = { version, model };
      return text;
    } catch (err: any) {
      if (err.message && err.message.includes('Недійсний Gemini API ключ')) {
        throw err;
      }
      console.warn(`Gemini (${model} ${version}) помилка або ліміт, перемикаємось далі:`, err);
      lastError = err;
    }
  }

  // Якщо ВСІ моделі вичерпали ліміти
  if (rateLimitedModels.length > 0 && rateLimitedModels.length >= candidates.length - 1) {
    throw new Error(
      `Усі доступні моделі Gemini (${rateLimitedModels.join(', ')}) тимчасово вичерпали хвилинний ліміт безкоштовної квоти Google. Зачекайте 20-30 секунд для скидання ліміту.`
    );
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
