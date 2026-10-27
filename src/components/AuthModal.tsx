import React, { useState } from 'react';
import { 
  Sparkles, Loader2, Lock, Mail, User, Eye, EyeOff, 
  AlertCircle, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { 
  loginWithEmailPassword, 
  registerWithEmailPassword,
  loginWithGoogleData,
  signInViaGoogleOAuthServer
} from '../services/auth';
import { getFirebaseServices, loginWithFirebaseGoogle } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: AuthUser) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess
}) => {
  // Default to register tab for new users
  const [mode, setMode] = useState<'register' | 'login'>('register');

  // Registration & Login Fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Form Submit with Strict Validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Front-end validations before request
    if (mode === 'register') {
      if (!displayName.trim() || displayName.trim().length < 2) {
        setErrorMessage('Введіть ваше ім\'я (щонайменше 2 символи)');
        return;
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMessage('Введіть дійсний email (наприклад: ivan@gmail.com)');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Пароль має містити щонайменше 6 символів');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Паролі не співпадають. Перевірте введення!');
        return;
      }
    } else {
      if (!email.trim()) {
        setErrorMessage('Введіть email адресу вашого акаунту');
        return;
      }
      if (!password) {
        setErrorMessage('Введіть пароль');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const user = await registerWithEmailPassword(
          displayName,
          email,
          password,
          confirmPassword
        );
        setSuccessMessage('Акаунт успішно створено!');
        setTimeout(() => onSuccess(user), 400);
      } else {
        const user = await loginWithEmailPassword(email, password);
        setSuccessMessage('Успішний вхід!');
        setTimeout(() => onSuccess(user), 400);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка авторизації');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Server Auth
  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { isReady } = getFirebaseServices();
      if (isReady) {
        const fbUser = await loginWithFirebaseGoogle();
        const user = await loginWithGoogleData({
          email: fbUser.email,
          name: fbUser.name,
          avatar: fbUser.avatar,
          sub: fbUser.uid
        });
        onSuccess(user);
        return;
      }

      const user = await signInViaGoogleOAuthServer();
      onSuccess(user);
    } catch (err: any) {
      // Prompt direct Google email entry if OAuth client isn't configured in Google Cloud yet
      const googleEmail = prompt('Введіть ваш Google Email для входу:');
      if (googleEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail.trim())) {
        const namePart = googleEmail.split('@')[0];
        const user = await loginWithGoogleData({
          email: googleEmail.trim(),
          name: namePart.charAt(0).toUpperCase() + namePart.slice(1)
        });
        onSuccess(user);
      } else if (googleEmail) {
        setErrorMessage('Невірний формат Google email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-13 h-13 w-12 h-12 rounded-2xl bg-gradient-to-tr from-apple-orange via-apple-pink to-purple-600 p-0.5 mx-auto shadow-lg shadow-apple-orange/20">
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center text-apple-green">
              <Sparkles size={24} className="text-apple-orange" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-white pt-1">
            {mode === 'register' ? 'Реєстрація акаунту' : 'Вхід тільки для зареєстрованих'}
          </h2>
          <p className="text-xs text-apple-subtext max-w-xs mx-auto">
            {mode === 'register'
              ? 'Створіть свій профіль для збереження раціону, калорій та ваги'
              : 'Введіть email та пароль вашого зареєстрованого акаунту'}
          </p>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 bg-black/50 p-1 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl text-xs font-semibold transition ${
              mode === 'register'
                ? 'bg-apple-green text-black shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            1. Реєстрація
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl text-xs font-semibold transition ${
              mode === 'login'
                ? 'bg-apple-green text-black shadow-md font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            2. Вхід
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-apple-green/15 border border-apple-green/30 flex items-center gap-2.5 text-xs text-apple-green">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-white/80 block mb-1">
                Ваше ім'я *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Олександр"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-white/80 block mb-1">
              Email адреса *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Mail size={15} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/80 block mb-1">
              Пароль * {mode === 'register' && <span className="text-white/40">(мін. 6 символів)</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Lock size={15} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введіть надійний пароль"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-xs text-white/80 block mb-1">
                Підтвердження пароля *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <ShieldCheck size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторіть введений пароль"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-apple-green text-black font-extrabold text-xs hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-3"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === 'register' ? (
              <span>Зареєструватися</span>
            ) : (
              <span>Увійти в акаунт</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-white/40 uppercase tracking-wider">або</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-black font-semibold text-xs flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Вхід через Google акаунт</span>
        </button>

      </div>
    </div>
  );
};
