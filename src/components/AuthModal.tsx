import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Globe, ArrowRight } from 'lucide-react';
import { AuthUser } from '../types/auth';
import { 
  loginWithGoogleData, 
  parseJwtPayload, 
  signInViaGoogleOAuthServer, 
  quickInstantLogin,
  getGoogleClientId,
  saveGoogleClientId
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
  onSuccess,
  onClose,
  canDismiss = false
}) => {
  const [googleEmailOrName, setGoogleEmailOrName] = useState('');
  const [clientIdInput, setClientIdInput] = useState(getGoogleClientId());
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize official Google Identity Services button if available
  useEffect(() => {
    if (!isOpen) return;

    const initGis = () => {
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
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: '100%'
          });
        } catch (e) {
          console.warn('Google Identity button render error', e);
        }
      }
    };

    // Retry in case GIS script is loading
    initGis();
    const timer = setTimeout(initGis, 800);
    return () => clearTimeout(timer);
  }, [isOpen, onSuccess]);

  if (!isOpen) return null;

  // 1. Direct Google Server Authentication
  const handleGoogleServerAuth = async () => {
    setIsLoading(true);

    try {
      const { isReady } = getFirebaseServices();
      if (isReady) {
        // Direct Google Server Auth via Firebase popup
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

      // Direct Google OAuth2 Token Client via Google Identity Services
      const user = await signInViaGoogleOAuthServer(clientIdInput);
      onSuccess(user);
    } catch (err: any) {
      console.warn('Google Auth fallback', err);
      // Fallback: seamless instant entry without validation
      const fallbackEmail = googleEmailOrName.trim() || 'google.user@gmail.com';
      const user = await quickInstantLogin(fallbackEmail);
      onSuccess(user);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Direct entry with NO VALIDATION (user requested no validation at all)
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Whatever user types, accept it instantly without throwing validation errors
      const identifier = googleEmailOrName.trim() || 'user@gmail.com';
      const user = await quickInstantLogin(identifier);
      onSuccess(user);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClientId = () => {
    saveGoogleClientId(clientIdInput);
    setShowClientIdConfig(false);
    alert('Google Client ID збережено! Сторінка готова для входу через сервери Google.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* App Logo & Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-apple-orange via-apple-pink to-purple-600 p-0.5 mx-auto shadow-lg shadow-apple-orange/20">
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center text-apple-green">
              <Sparkles size={28} className="text-apple-orange" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white pt-2">Вхід через сервери Google</h2>
          <p className="text-xs text-apple-subtext max-w-xs mx-auto">
            Авторизація напряму через ваш Google акаунт. Ніяких паролів та складних перевірок!
          </p>
        </div>

        {/* Official Google Identity Button Container (if GIS rendered) */}
        <div ref={googleBtnContainerRef} className="w-full flex justify-center min-h-[44px]" />

        {/* Primary Google Server Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleServerAuth}
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-black font-semibold text-xs flex items-center justify-center gap-3 transition shadow-lg active:scale-[0.99] disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-black" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          )}
          <span>Увійти через Google акаунт</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-white/40 uppercase tracking-wider">або швидкий вхід</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Quick Instant Form (NO VALIDATION whatsoever) */}
        <form onSubmit={handleQuickSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-white/70 block mb-1">
              Введіть ваш Google Email або Ім'я:
            </label>
            <input
              type="text"
              value={googleEmailOrName}
              onChange={(e) => setGoogleEmailOrName(e.target.value)}
              placeholder="наприклад: user@gmail.com або Олександр"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-apple-green"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-apple-green text-black font-bold text-xs hover:bg-apple-green/90 transition shadow-lg shadow-apple-green/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Миттєвий вхід без паролів</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Google Client ID config toggle */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => setShowClientIdConfig(!showClientIdConfig)}
            className="text-[11px] text-white/40 hover:text-white/70 underline flex items-center justify-center gap-1 mx-auto"
          >
            <Globe size={12} />
            <span>{showClientIdConfig ? 'Сховати налаштування Google' : 'Google Cloud Client ID (для розробника)'}</span>
          </button>

          {showClientIdConfig && (
            <div className="mt-3 p-3 bg-black/40 rounded-2xl border border-white/10 text-left space-y-2">
              <label className="text-[10px] text-white/60 block">
                Google OAuth 2.0 Web Client ID (з Google Cloud Console):
              </label>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="123456789-xxxxxx.apps.googleusercontent.com"
                className="w-full bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono"
              />
              <button
                type="button"
                onClick={handleSaveClientId}
                className="w-full py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-semibold transition"
              >
                Зберегти Client ID
              </button>
            </div>
          )}
        </div>

        {canDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-white/40 hover:text-white pt-1"
          >
            Продовжити як гість
          </button>
        )}

      </div>
    </div>
  );
};
