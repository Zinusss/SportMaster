import { ChatMessage, FoodAnalysisResult } from '../types';

// Список моделей за замовчуванням у порядку пріоритету (найвищі ліміти 15 RPM / 1500 RPD)
const FALLBACK_MODEL_CANDIDATES = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-pro',
  'gemini-2.5-flash'
];

interface ActiveSession {
  apiKey: string;
  activeModel: string;
  candidateModels: string[];
}

let activeSession: ActiveSession | null = null;

/**
 * Перекладає сирі системні помилки Google Gemini на зрозумілу українську мову з конкретними інструкціями
 */
export function translateGeminiError(rawMsg: string): string {
  const msg = rawMsg || '';

  if (msg.includes('API key not valid') || msg.toLowerCase().includes('api_key_invalid')) {
    return 'Недійсний Gemini API ключ. Будь ласка, перевірте правильність копіювання в Профілі (без зайвих пробілів).';
  }

  if (
    msg.includes('Generative Language API has not been used') ||
    msg.includes('is disabled') ||
    msg.includes('it is disabled')
  ) {
    const projectMatch = msg.match(/project (\d+)/i);
    const projectId = projectMatch ? projectMatch[1] : '';
    const link = projectId 
      ? `https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=${projectId}`
      : 'https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com';

    return `У вашому Google Cloud проєкті вимкнено Generative Language API. Увімкніть його за посиланням: ${link} (натисніть синю кнопку «Увімкнути / Enable»).`;
  }

  if (msg.toLowerCase().includes('user location is not supported')) {
    return 'Google Gemini API блокує запити з вашого поточного регіону чи мережі. Спробуйте ввімкнути VPN.';
  }

  if (msg.toLowerCase().includes('resource_exhausted') || msg.toLowerCase().includes('quota') || msg.includes('429')) {
    return 'Перевищено хвилинний ліміт безкоштовних запитів Google Gemini. Зачекайте 15–20 секунд для скидання ліміту.';
  }

  if (msg.includes('API key restrictions') || msg.includes('blocked')) {
    return 'Цей API ключ має обмеження домену/IP в Google Cloud. Зніміть обмеження в Credentials.';
  }

  if (msg.includes('not found') || msg.includes('404')) {
    return 'Модель не знайдена для цього проєкту. Створіть новий ключ у Google AI Studio (https://aistudio.google.com/app/apikey) натиснувши «Create API key in new project» або ввімкніть Generative Language API у вашому проєкті.';
  }

  return msg;
}

/**
 * Запитує у Google точний список доступних моделей для конкретного API-ключа
 */
async function fetchAvailableModels(apiKey: string): Promise<{ models: string[]; error?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      return { models: [], error: errMsg };
    }

    const rawList: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];
    const contentModels = rawList
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));

    return { models: contentModels };
  } catch (e: any) {
    return { models: [], error: e.message || 'Помилка мережі' };
  }
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

  // 1. Опитуємо офіційний ендпоінт Google моделей
  const discovery = await fetchAvailableModels(trimmedKey);
  if (discovery.error) {
    return {
      valid: false,
      error: translateGeminiError(discovery.error)
    };
  }

  // 2. Складаємо впорядкований список доступних моделей
  let candidateModels: string[] = [];
  if (discovery.models.length > 0) {
    for (const p of FALLBACK_MODEL_CANDIDATES) {
      if (discovery.models.includes(p)) {
        candidateModels.push(p);
      }
    }
    for (const m of discovery.models) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }
  } else {
    candidateModels = [...FALLBACK_MODEL_CANDIDATES];
  }

  // 3. Тестуємо запит генерації
  let lastError = '';
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      if (res.ok) {
        activeSession = {
          apiKey: trimmedKey,
          activeModel: model,
          candidateModels
        };
        return { valid: true, modelName: model };
      }

      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `HTTP ${res.status}`;

      // Якщо 429 — це означає що ключ правильний, просто черга тимчасово зайнята, переходимо далі
      if (res.status === 429 || lastError.toLowerCase().includes('resource_exhausted')) {
        continue;
      }
    } catch (e: any) {
      lastError = e.message || 'Помилка мережі';
    }
  }

  return { valid: false, error: translateGeminiError(lastError) };
}

/**
 * Calls Gemini with dynamic model discovery and AUTOMATIC MODEL SWAPPING on rate limits (429)
 */
async function callGemini(apiKey: string, body: any): Promise<string> {
  const trimmedKey = apiKey.trim();

  // Скидаємо стару сесію, якщо введено інший ключ
  if (activeSession && activeSession.apiKey !== trimmedKey) {
    activeSession = null;
  }

  // 1. Якщо сесія ще не ініціалізована — відкриваємо її через автовизначення моделей
  if (!activeSession) {
    const discovery = await fetchAvailableModels(trimmedKey);
    if (discovery.error) {
      throw new Error(translateGeminiError(discovery.error));
    }

    let candidateModels: string[] = [];
    if (discovery.models.length > 0) {
      for (const p of FALLBACK_MODEL_CANDIDATES) {
        if (discovery.models.includes(p)) candidateModels.push(p);
      }
      for (const m of discovery.models) {
        if (!candidateModels.includes(m)) candidateModels.push(m);
      }
    } else {
      candidateModels = [...FALLBACK_MODEL_CANDIDATES];
    }

    activeSession = {
      apiKey: trimmedKey,
      activeModel: candidateModels[0] || 'gemini-1.5-flash',
      candidateModels
    };
  }

  const candidateModels = activeSession.candidateModels;
  let lastError: any = null;
  let exhaustedCount = 0;

  // Починаємо з поточної активної моделі
  const orderedModels = [
    activeSession.activeModel,
    ...candidateModels.filter((m) => m !== activeSession?.activeModel)
  ];

  for (const model of orderedModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `Помилка Gemini API (${model}): ${res.status}`;

        // Rate limit (429 / RESOURCE_EXHAUSTED) -> АВТОМАТИЧНИЙ СВАП МОДЕЛІ!
        if (
          res.status === 429 || 
          msg.toLowerCase().includes('resource_exhausted') || 
          msg.toLowerCase().includes('quota')
        ) {
          exhaustedCount++;
          console.warn(
            `[SportMaster AI] Модель ${model} досягла ліміту (429). Автоматично свапаємо на наступну модель...`
          );
          lastError = new Error(msg);
          continue;
        }

        // Якщо помилка стосується відключеного API або недійсного ключа — кидаємо негайно з поясненням
        if (
          msg.includes('Generative Language API has not been used') ||
          msg.includes('is disabled') ||
          msg.includes('API key not valid')
        ) {
          throw new Error(translateGeminiError(msg));
        }

        throw new Error(msg);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Порожня відповідь від моделі');

      // Успішно! Оновлюємо активну працюючу модель
      if (activeSession) {
        activeSession.activeModel = model;
      }
      return text;
    } catch (err: any) {
      const errMsg = err.message || '';
      if (
        errMsg.includes('Generative Language API') ||
        errMsg.includes('Недійсний Gemini API ключ') ||
        errMsg.includes('Google Gemini API блокує')
      ) {
        throw err;
      }
      console.warn(`Gemini (${model}) помилка або ліміт, перемикаємось далі:`, err);
      lastError = err;
    }
  }

  // Якщо ВСІ моделі вичерпали ліміти
  if (exhaustedCount >= orderedModels.length) {
    throw new Error(
      `Усі доступні моделі Gemini (${orderedModels.join(', ')}) тимчасово вичерпали хвилинний ліміт безкоштовної квоти Google. Зачекайте 20–30 секунд для скидання ліміту.`
    );
  }

  throw new Error(translateGeminiError(lastError?.message || 'Не вдалося виконати запит до Gemini'));
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
