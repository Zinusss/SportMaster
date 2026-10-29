import React, { useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { Dashboard } from './components/Dashboard';
import { AIChatView } from './components/AIChatView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileView } from './components/ProfileView';
import { Navigation, NavTab } from './components/Navigation';
import { AddMealModal } from './components/AddMealModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthView } from './components/AuthView';
import { MealType } from './types';
import { AuthUser } from './types/auth';
import { getCurrentSession, logoutUser } from './services/auth';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentSession());

  const {
    profile,
    updateProfile,
    days,
    currentDate,
    setCurrentDate,
    currentDayLog,
    addFoodEntry,
    removeFoodEntry,
    addWater,
    setSteps,
    addSteps,
    chatHistory,
    addChatMessage,
    clearChat,
    exportData,
    importData,
    resetAllData,
    isCloudSyncing,
    lastGoogleSync,
    syncNowWithGoogleDrive
  } = useAppData(currentUser);

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveMeal = (entry: any) => {
    addFoodEntry(currentDate, entry);
    setToastMessage(`✓ Збережено: ${entry.name} (${entry.calories} ккал)`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const handleOpenAddMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddMealOpen(true);
  };

  const handleUpdateWeight = (newWeight: number) => {
    updateProfile({ weight: newWeight });
  };

  // If not logged in, render the full-screen premium Auth Page (like GitHub / Linear)
  if (!currentUser) {
    return <AuthView onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-apple-green selection:text-black">
      
      {/* Main View Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        {currentTab === 'dashboard' && (
          <Dashboard
            profile={profile}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            dayLog={currentDayLog}
            onAddMealClick={handleOpenAddMeal}
            onRemoveFoodEntry={removeFoodEntry}
            onAddWater={addWater}
            onAddSteps={addSteps}
            onSetSteps={setSteps}
          />
        )}

        {currentTab === 'chat' && (
          <AIChatView
            profile={profile}
            dayLog={currentDayLog}
            chatHistory={chatHistory}
            onSendMessage={addChatMessage}
            onClearChat={clearChat}
            onOpenSettings={() => setCurrentTab('profile')}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            profile={profile}
            days={days}
            onUpdateWeight={handleUpdateWeight}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenAuth={() => setCurrentUser(null)}
            profile={profile}
            days={days}
            chatHistory={chatHistory}
            onUpdateProfile={updateProfile}
            onExportData={exportData}
            onImportData={importData}
            onResetData={resetAllData}
            isCloudSyncing={isCloudSyncing}
            lastGoogleSync={lastGoogleSync}
            onSyncGoogleDrive={syncNowWithGoogleDrive}
          />
        )}
      </main>

      {/* iOS Floating Bottom Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        unreadChatBadge={false}
      />

      {/* Top Floating Notification (iOS Dynamic Pill) */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2.5 rounded-full bg-[#1C1C1E]/95 border border-apple-green/40 shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-semibold text-white animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add Meal Modal (3 methods: manual, AI text, AI photo) */}
      <AddMealModal
        isOpen={isAddMealOpen}
        onClose={() => setIsAddMealOpen(false)}
        defaultMealType={selectedMealType}
        geminiApiKey={profile.geminiApiKey}
        onSave={handleSaveMeal}
        onOpenSettings={() => {
          setIsAddMealOpen(false);
          setCurrentTab('profile');
        }}
      />

      {/* Onboarding Wizard (runs on first launch of this account if profile metrics not yet set) */}
      <OnboardingModal
        isOpen={!profile.isOnboarded}
        currentUser={currentUser}
        onComplete={(onboardedData) => updateProfile(onboardedData)}
      />

    </div>
  );
};

export default App;
