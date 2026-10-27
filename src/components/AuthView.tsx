import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Loader2, Mail, ArrowRight, CheckCircle2, 
  AlertCircle, KeyRound, RefreshCw, ShieldCheck
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { 
  loginWithGoogleData, 
  getGoogleClientId,
  getGoogleOAuthRedirectUrl,
  sendEmailVerificationCode, 
  verifyEmailCode 
} from '../services/auth';

interface AuthViewProps {
  onSuccess: (user: AuthUser) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  // Mode: 'email_input' | 'otp_verify'
  const [authStep, setAuthStep] = useState<'email_input' | 'otp_verify'>('email_input');
  
  // Fields
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Catch Google OAuth Callback from URL Hash (#access_token=...)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        setIsLoading(true);
        setSuccessMessage('Отримано відповідь від Google серверів. Завантаження профілю...');

        // Fetch verified userinfo from Google's servers
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
          .then((res) => {
            if (!res.ok) throw new Error('Помилка Google сервера: ' + res.status);
            return res.json();
          })
          .then(async (userInfo) => {
            if (!userInfo.email) throw new Error('Email не надано Google сервером');

            const user = await loginWithGoogleData({
              email: userInfo.email,
              name: userInfo.name,
              avatar: userInfo.picture,
              sub: userInfo.sub
            });

            // Clean hash from URL bar
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            setSuccessMessage(`Успішний вхід: ${userInfo.email}!`);
            setTimeout(() => onSuccess(user), 300);
          })
          .catch((err: any) => {
            console.error('Google callback error', err);
            setErrorMessage('Помилка авторизації через Google: ' + err.message);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [onSuccess]);

  // 1. Click "Увійти через Google" -> Direct redirect to accounts.google.com/v3/signin/accountchooser
  const handleGoogleSignInClick = () => {
    setErrorMessage(null);
    const clientId = getGoogleClientId();

    if (!clientId) {
      setErrorMessage('Google Client ID не знайдено в конфігурації проєкту');
      return;
    }

    if (clientId.startsWith('AIzaSy')) {
      setErrorMessage(
        'Помилка конфігурації: у файлі secrets.ts вказано API-ключ (AIzaSy...), а для входу в Google потрібен саме OAuth Client ID (що закінчується на .apps.googleusercontent.com з розділу Credentials у Google Cloud Console).'
      );
      return;
    }

    // Redirect directly to Google OAuth Account Chooser
    const redirectUrl = getGoogleOAuthRedirectUrl(clientId);
    window.location.href = redirectUrl;
  };

  // 2. Email: Send code to actual email (NEVER show on screen!)
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Введіть дійсний email (наприклад: name@gmail.com)');
      return;
    }

    setIsLoading(true);
    try {
      await sendEmailVerificationCode(cleanEmail);
      setAuthStep('otp_verify');
      setSuccessMessage(`Лист з 6-значним кодом надіслано на ${cleanEmail}!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка надсилання коду');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Email: Verify code from user's inbox
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Введіть 6 цифр коду з листа');
      return;
    }

    setIsLoading(true);
    try {
      const user = await verifyEmailCode(email, otpCode.trim());
      setSuccessMessage('Код підтверджено! Вхід виконано.');
      setTimeout(() => onSuccess(user), 300);
    } catch (err: any) {
      setErrorMessage(err.message || 'Невірний код або термін дії вичерпано');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-purple-600/20 via-apple-orange/15 to-apple-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Logo & Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-apple-orange via-apple-pink to-purple-600 p-0.5 mx-auto shadow-2xl shadow-apple-orange/20">
            <div className="w-full h-full bg-black rounded-[22px] flex items-center justify-center">
              <Sparkles size={32} className="text-apple-orange" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight pt-1">
            SportMaster AI
          </h1>
          <p className="text-xs text-apple-subtext max-w-xs mx-auto leading-relaxed">
            Персональний AI-трекер харчування, КБЖВ та коуч на базі Google Gemini
          </p>
        </div>

        {/* Auth Card */}
        <div className="ios-glass-card rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5">
          
          <div className="text-center pb-1">
            <h2 className="text-base font-bold text-white">Вхід до акаунту</h2>
            <p className="text-[11px] text-white/50">Авторизація через сервери Google або пошту</p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-apple-green/15 border border-apple-green/30 flex items-center gap-2.5 text-xs text-apple-green animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Official Google Button (Directly opens https://accounts.google.com/v3/signin/accountchooser) */}
          <button
            type="button"
            onClick={handleGoogleSignInClick}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition shadow-xl active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin text-black" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            <span>Увійти через Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider whitespace-nowrap">
              або за поштою з кодом
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* 2. Email Flow - STEP 1: Enter email */}
          {authStep === 'email_input' && (
            <form onSubmit={handleSendCode} className="space-y-3.5">
              <div>
                <label className="text-xs text-white/80 block mb-1.5 font-medium">
                  Ваша Email адреса
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none focus:border-apple-green transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-3.5 rounded-2xl bg-apple-green text-black font-extrabold text-xs sm:text-sm hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin text-black" />
                ) : (
                  <>
                    <span>Надіслати код на мою пошту</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. Email Flow - STEP 2: Enter 6-digit code received in email (NEVER shown on screen!) */}
          {authStep === 'otp_verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
                  <ShieldCheck size={16} />
                  <span>Лист надіслано на вашу пошту</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  Будь ласка, перевірте вхідні або папку «Спам» на пошті <strong>{email}</strong> та введіть отриманий 6-значний код:
                </p>
              </div>

              <div>
                <label className="text-xs text-white/80 block mb-1.5 font-medium">
                  Введіть 6-значний код з листа:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="______"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl pl-10 pr-4 py-3 text-center tracking-[0.4em] text-lg font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-apple-green transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-apple-green text-black font-extrabold text-xs sm:text-sm hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin text-black" />
                ) : (
                  <>
                    <span>Підтвердити та увійти</span>
                    <CheckCircle2 size={16} />
                  </>
                )}
              </button>

              <div className="flex justify-between items-center text-xs text-white/50 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('email_input');
                    setOtpCode('');
                    setErrorMessage(null);
                  }}
                  className="hover:text-white transition underline"
                >
                  Змінити email
                </button>
                <button
                  type="button"
                  onClick={handleSendCode}
                  className="hover:text-cyan-400 transition flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  <span>Надіслати код ще раз</span>
                </button>
              </div>

            </form>
          )}

        </div>

      </div>

    </div>
  );
};
