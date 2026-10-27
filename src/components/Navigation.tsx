import React from 'react';
import { Flame, Sparkles, TrendingUp, User } from 'lucide-react';

export type NavTab = 'dashboard' | 'chat' | 'analytics' | 'profile';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadChatBadge?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  unreadChatBadge = false
}) => {
  const tabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'Харчування',
      icon: Flame,
      color: 'text-apple-orange',
      activeColor: 'bg-apple-orange/15 text-apple-orange'
    },
    {
      id: 'chat' as NavTab,
      label: 'Gemini Коуч',
      icon: Sparkles,
      color: 'text-purple-400',
      activeColor: 'bg-purple-500/15 text-purple-400',
      hasBadge: unreadChatBadge
    },
    {
      id: 'analytics' as NavTab,
      label: 'Прогрес',
      icon: TrendingUp,
      color: 'text-apple-blue',
      activeColor: 'bg-apple-blue/15 text-apple-blue'
    },
    {
      id: 'profile' as NavTab,
      label: 'Профіль',
      icon: User,
      color: 'text-apple-green',
      activeColor: 'bg-apple-green/15 text-apple-green'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 ios-glass-nav pb-safe">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 ${
                isActive ? tab.activeColor : 'text-white/40 hover:text-white/80'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-black animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
