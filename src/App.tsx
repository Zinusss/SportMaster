import React, { useState, useEffect } from 'react';
import { useAppData } from './hooks/useAppData';
import { Dashboard } from './components/Dashboard';
import { AIChatView } from './components/AIChatView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileView } from './components/ProfileView';
import { Navigation, NavTab } from './components/Navigation';
import { AddMealModal } from './components/AddMealModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthModal } from './components/AuthModal';
import { MealType } from './types';
import { AuthUser } from './types/auth';
import { getCurrentSession, logoutUser } from './services/auth';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => !getCurrentSession());

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
    isCloudSyncing
  } = useAppData(currentUser);

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');

  // If user signs out, prompt auth
  useEffect(() => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
    }
  }, [currentUser]);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setIsAuthModalOpen(true);
  };

  const handleOpenAddMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddMealOpen(true);
  };

  const handleUpdateWeight = (newWeight: number) => {
    updateProfile({ weight: newWeight });
  };

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
            onOpenAuth={() => setIsAuthModalOpen(true)}
            profile={profile}
            days={days}
            chatHistory={chatHistory}
            onUpdateProfile={updateProfile}
            onExportData={exportData}
            onImportData={importData}
            onResetData={resetAllData}
            isCloudSyncing={isCloudSyncing}
          />
        )}
      </main>

      {/* iOS Floating Bottom Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        unreadChatBadge={false}
      />

      {/* Add Meal Modal (3 methods: manual, AI text, AI photo) */}
      <AddMealModal
        isOpen={isAddMealOpen}
        onClose={() => setIsAddMealOpen(false)}
        defaultMealType={selectedMealType}
        geminiApiKey={profile.geminiApiKey}
        onSave={(entry) => addFoodEntry(currentDate, entry)}
        onOpenSettings={() => {
          setIsAddMealOpen(false);
          setCurrentTab('profile');
        }}
      />

      {/* Full Authentication Modal (Login / Register / Google Auth) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={handleAuthSuccess}
        onClose={() => setIsAuthModalOpen(false)}
        canDismiss={!!currentUser}
      />

      {/* Onboarding Wizard (runs on first launch of this account if profile metrics not yet set) */}
      <OnboardingModal
        isOpen={!!currentUser && !profile.isOnboarded}
        currentUser={currentUser}
        onComplete={(onboardedData) => updateProfile(onboardedData)}
      />

    </div>
  );
};

export default App;
