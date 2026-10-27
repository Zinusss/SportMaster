import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Loader2, Mail, ArrowRight, CheckCircle2, 
  AlertCircle, KeyRound, RefreshCw, ShieldCheck
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { 
  loginWithGoogleData, 
  parseJwtPayload, 
  signInViaGoogleOAuthServer, 
  sendEmailVerificationCode, 
  verifyEmailCode,
  getGoogleClientId
} from '../services/auth';
import { getFirebaseServices, loginWithFirebaseGoogle } from '../services/firebase';

interface AuthViewProps {
  onSuccess: (user: AuthUser) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  // Step: 'email_input' | 'otp_verify'
  const [authStep, setAuthStep] = useState<'email_input' | 'otp_verify'>('email_input');
  
  // Fields
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sentCodeDisplay, setSentCodeDisplay] = useState<string | null>(null);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize official Google Identity Services button if available
  useEffect(() => {
    const google = (window as any).google;
    const clientId = getGoogleClientId();

    if (google?.accounts?.id && clientId && googleBtnContainerRef.current) {
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              const payload = parseJwtPayload(response.credential);
              if (payload) {
                const user = await loginWithGoogleData({
                  email: payload.email,
                  name: payload.name,
                  avatar: payload.picture,
                  sub: payload.sub
                });
                onSuccess(user);
              }
            }
          }
        });

        googleBtnContainerRef.current.innerHTML = '';
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: '100%'
        });
      } catch (e) {
        console.warn('Google Identity button render error', e);
      }
    }
  }, [onSuccess]);

  // 1. Google One-Click Server Authentication (like GitHub / Notion)
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
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
        setSuccessMessage('Успішний вхід через Google!');
        setTimeout(() => onSuccess(user), 300);
        return;
      }

      // Direct Google OAuth2 Token Client via GIS
      const user = await signInViaGoogleOAuthServer();
      setSuccessMessage('Успішний вхід через Google!');
      setTimeout(() => onSuccess(user), 300);
    } catch (err: any) {
      setErrorMessage(err.message || 'Не вдалося увійти через Google');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Email Step 1: Send 6-digit confirmation code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Введіть дійсну пошту (наприклад: name@gmail.com)');
      return;
    }

    setIsLoading(true);
    try {
      const { code } = await sendEmailVerificationCode(cleanEmail);
      setSentCodeDisplay(code);
      setAuthStep('otp_verify');
      setSuccessMessage('Код підтвердження успішно згенеровано!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка надсилання коду');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Email Step 2: Verify confirmation code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Код має містити рівно 6 цифр');
      return;
    }

    setIsLoading(true);
    try {
      const user = await verifyEmailCode(email, otpCode.trim());
      setSuccessMessage('Пошту підтверджено! Вхід виконано.');
      setTimeout(() => onSuccess(user), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка верифікації коду');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none">
      
      {/* Background Apple Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-purple-600/20 via-apple-orange/15 to-apple-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Top Header / Branding */}
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
            Розумний AI-трекер харчування, розрахунку КБЖВ та персональний коуч на базі Google Gemini
          </p>
        </div>

        {/* Main Card (GitHub / Modern SaaS style) */}
        <div className="ios-glass-card rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5">
          
          <div className="text-center pb-1">
            <h2 className="text-base font-bold text-white">Вхід до акаунту</h2>
            <p className="text-[11px] text-white/50">Оберіть зручний спосіб входу</p>
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

          {/* GIS Native Button Container */}
          <div ref={googleBtnContainerRef} className="w-full flex justify-center" />

          {/* Big Official Google Sign-In Button (Like on GitHub / Linear) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
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
            <span>Продовжити через Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider whitespace-nowrap">
              або за поштою з кодом
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* STEP 1: Enter Email */}
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
                    <span>Отримати код підтвердження</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Enter 6-digit Code */}
          {authStep === 'otp_verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              
              {/* Sent Code Notice */}
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
                  <ShieldCheck size={16} />
                  <span>Код підтвердження надіслано</span>
                </div>
                <p className="text-[11px] text-white/70">
                  Ми надіслали 6-значний одноразовий код на <strong>{email}</strong>
                </p>
                {sentCodeDisplay && (
                  <div className="pt-1.5 flex items-center justify-between border-t border-cyan-500/10">
                    <span className="text-[10px] text-white/50">Ваш код безпеки:</span>
                    <span className="text-sm font-mono font-bold tracking-widest text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-lg">
                      {sentCodeDisplay}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/80 block mb-1.5 font-medium">
                  Введіть 6-значний код:
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
                    placeholder="123456"
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
                  <span>Надіслати повторно</span>
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
          <ShieldCheck size={14} className="text-apple-green" />
          <span>Ваші дані та раціон надійно захищені та прив'язані до вашого акаунта</span>
        </div>

      </div>
    </div>
  );
};
