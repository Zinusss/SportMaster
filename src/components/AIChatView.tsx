import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Bot, User as UserIcon, Loader2, AlertCircle, Info } from 'lucide-react';
import { ChatMessage, DayLog, UserProfile } from '../types';
import { sendNutritionChat } from '../services/gemini';
import { GOAL_LABELS } from '../utils/nutrition';

interface AIChatViewProps {
  profile: UserProfile;
  dayLog: DayLog;
  chatHistory: ChatMessage[];
  onSendMessage: (role: 'user' | 'assistant', content: string) => void;
  onClearChat: () => void;
  onOpenSettings: () => void;
}

function renderInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-bold text-white tracking-wide">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic text-white/80">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={match.index} className="bg-white/10 px-1 py-0.5 rounded text-[11px] font-mono text-apple-green">
          {match[4]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

const FormattedMessage: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Заголовки розділів (### або ##)
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const headingText = trimmed.replace(/^#{2,3}\s+/, '');
          return (
            <div key={idx} className="font-bold text-apple-green text-xs sm:text-sm pt-1.5 pb-0.5">
              {renderInlineFormatting(headingText)}
            </div>
          );
        }

        // Марковані списки (- або * або •)
        if (/^[-*•]\s+/.test(trimmed)) {
          const itemText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="text-apple-green font-bold text-sm leading-4 select-none shrink-0">•</span>
              <span className="flex-1 text-white/90">{renderInlineFormatting(itemText)}</span>
            </div>
          );
        }

        // Нумеровані списки (1. 2. 3.)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="text-apple-green font-semibold text-xs leading-5 shrink-0 select-none">
                {numMatch[1]}.
              </span>
              <span className="flex-1 text-white/90">{renderInlineFormatting(numMatch[2])}</span>
            </div>
          );
        }

        // Звичайний текст
        return (
          <div key={idx} className="text-white/90">
            {renderInlineFormatting(line)}
          </div>
        );
      })}
    </div>
  );
};

export const AIChatView: React.FC<AIChatViewProps> = ({
  profile,
  dayLog,
  chatHistory,
  onSendMessage,
  onClearChat,
  onOpenSettings
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping]);

  // Construct context string to inject into Gemini prompt
  const buildUserContext = () => {
    const totalCal = dayLog.meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProt = dayLog.meals.reduce((sum, m) => sum + m.proteins, 0);
    const totalFat = dayLog.meals.reduce((sum, m) => sum + m.fats, 0);
    const totalCarb = dayLog.meals.reduce((sum, m) => sum + m.carbs, 0);
    const mealsList = dayLog.meals.map((m) => `${m.name} (${m.weightGrams}г: ${m.calories}ккал, Б:${m.proteins}г, Ж:${m.fats}г, В:${m.carbs}г)`).join('; ');

    return `
- Ім'я: ${profile.name}
- Стать: ${profile.gender === 'male' ? 'Чоловік' : 'Жінка'}, Вік: ${profile.age} років
- Зріст: ${profile.height} см, Поточна вага: ${profile.weight} кг, Бажана вага: ${profile.targetWeight} кг
- Ціль: ${GOAL_LABELS[profile.goal]?.label || profile.goal}
- Розрахункова добова норма: ${profile.calculatedTargets.calories} ккал (Б: ${profile.calculatedTargets.proteins}г, Ж: ${profile.calculatedTargets.fats}г, В: ${profile.calculatedTargets.carbs}г)
- Сьогодні вже спожито: ${totalCal} ккал (Б: ${Math.round(totalProt)}г, Ж: ${Math.round(totalFat)}г, В: ${Math.round(totalCarb)}г)
- Залишилось на день: ${profile.calculatedTargets.calories - totalCal} ккал
- Записані страви за день: ${mealsList || 'Поки що нічого не записано'}
- Пройдено кроків: ${dayLog.steps || 0} з ${profile.calculatedTargets.dailyStepsTarget}
- Випито води: ${dayLog.waterMl || 0} мл з ${profile.calculatedTargets.waterMl} мл
    `.trim();
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!profile.geminiApiKey) {
      setErrorMessage('Будь ласка, вкажіть ваш Gemini API ключ у налаштуваннях або профілі.');
      return;
    }

    setErrorMessage(null);
    setInputText('');
    onSendMessage('user', text);
    setIsTyping(true);

    try {
      const context = buildUserContext();
      const answer = await sendNutritionChat(chatHistory, text, context, profile.geminiApiKey);
      onSendMessage('assistant', answer);
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMessage(err.message || 'Не вдалося отримати відповідь від Gemini. Спробуйте ще раз.');
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    '🥗 Що з\'їсти на вечерю, щоб закрити норму білка?',
    '📊 Проаналізуй мій сьогоднішній раціон',
    '💪 Як краще розподілити прийоми їжі?',
    '🔥 Які продукти найкраще спалюють жир?'
  ];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto pt-safe pb-24 px-3">
      
      {/* Header */}
      <div className="ios-glass-card rounded-3xl p-4 mb-3 border border-white/10 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Gemini Sport Coach</span>
              <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse" />
            </h1>
            <p className="text-[11px] text-apple-subtext">Персональний ШІ-нутриціолог</p>
          </div>
        </div>

        <button
          onClick={onClearChat}
          className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/10 transition"
          title="Очистити діалог"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Live Context Badge */}
      <div className="mb-2.5 px-3 py-1.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-[11px] text-purple-300">
        <div className="flex items-center gap-1.5 truncate">
          <Bot size={13} className="shrink-0" />
          <span className="truncate">
            ШІ бачить ваш прогрес: {profile.calculatedTargets.calories - dayLog.meals.reduce((s, m) => s + m.calories, 0)} ккал в залишку
          </span>
        </div>
        <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded-full font-semibold shrink-0">
          Синхронізовано
        </span>
      </div>

      {/* Missing Key Banner */}
      {!profile.geminiApiKey && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
          <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span>Для спілкування з Gemini додайте безкоштовний ключ API. </span>
            <button
              onClick={onOpenSettings}
              className="underline font-semibold text-amber-400 hover:text-amber-300"
            >
              Додати в профілі →
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-400">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2">
        {chatHistory.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shrink-0 text-xs shadow-md">
                  <Sparkles size={13} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-sm shadow-md shadow-purple-600/20'
                    : 'bg-[#1C1C1E] border border-white/10 text-white/95 rounded-bl-sm shadow-md'
                }`}
              >
                <FormattedMessage content={msg.content} isUser={isUser} />
                <div
                  className={`text-[9px] mt-1.5 text-right ${
                    isUser ? 'text-white/60' : 'text-apple-subtext'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/80 shrink-0 text-xs">
                  <UserIcon size={13} />
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-purple-400 text-xs py-2 px-3 bg-purple-500/10 rounded-2xl w-fit">
            <Loader2 size={14} className="animate-spin" />
            <span>Gemini обмірковує відповідь...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="py-2 overflow-x-auto no-scrollbar flex gap-1.5 shrink-0">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={isTyping}
            className="text-[11px] bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1.5 rounded-full border border-white/5 whitespace-nowrap transition active:scale-95 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="pt-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="ios-glass-card rounded-2xl p-1.5 flex items-center gap-2 border border-white/15 shadow-xl"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Запитайте щось у Gemini тренера..."
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center disabled:opacity-40 transition active:scale-90 shrink-0 shadow-md shadow-purple-600/30"
          >
            <Send size={15} />
          </button>
        </form>
      </div>

    </div>
  );
};
