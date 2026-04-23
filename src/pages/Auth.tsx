import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import logoZio from '@/assets/logozio.png';
import heroPizza from '@/assets/fondopizza.jpg';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const fromCart = location.state?.fromCart === true;

  useEffect(() => {
    if (user) navigate(fromCart ? '/pedido' : '/perfil');
  }, [user, navigate, fromCart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t('auth.welcomeBack'));
        navigate('/perfil');
      }
    } else {
      if (password !== confirmPassword) {
        toast.error(t('auth.passwordMismatch'));
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t('auth.accountCreated'));
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error(error.message || 'Error al iniciar sesión con Google');
    }
    setGoogleLoading(false);
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error(error.message || 'Error al iniciar sesión con Apple');
    }
    setAppleLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 landscape-compact relative">
      <div className="absolute inset-0 z-0">
        <img src={heroPizza} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-foreground/80" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <a href="/">
            <img src={logoZio} alt="Lo Zio" className="h-16 w-auto mx-auto brightness-0 invert" />
          </a>
          <p className="text-primary-foreground/80 font-body mt-2">
            {isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
          </p>
        </div>

        {fromCart && (
          <div className="bg-menu-teal/10 border border-menu-teal/30 rounded-lg px-4 py-4 mb-4 text-center">
            <p className="text-primary-foreground font-display font-bold text-sm mb-1">
              🍕 Inicia sesión para completar tu pedido
            </p>
            <p className="text-primary-foreground/80 text-xs mb-3">
              Podrás seguir el estado en tiempo real y acumular puntos de recompensa.
            </p>
            <Link
              to="/pedido"
              className="text-primary-foreground/60 text-xs underline underline-offset-2 hover:text-primary-foreground/90 transition-colors"
            >
              Continuar sin cuenta — no recibiré actualizaciones del pedido
            </Link>
          </div>
        )}

        <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-background border border-input text-foreground py-3 min-h-[48px] rounded-sm font-body font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? t('auth.loading') : t('auth.googleSignIn', 'Continuar con Google')}
            </button>
            <button
              onClick={handleAppleSignIn}
              disabled={appleLoading}
              className="w-full flex items-center justify-center gap-3 bg-foreground text-background py-3 min-h-[48px] rounded-sm font-body font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {appleLoading ? t('auth.loading') : t('auth.appleSignIn', 'Continuar con Apple')}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-body">{t('auth.orEmail', 'o con email')}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-sm bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-sm bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-sm bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 min-h-[48px] rounded-sm font-body font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? t('auth.loading') : isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {isLogin && (
              <button
                onClick={() => navigate('/reset-password')}
                className="text-muted-foreground font-body text-sm hover:underline block mx-auto"
              >
                {t('auth.forgotPassword')}
              </button>
            )}
            <button
              onClick={() => {
                setIsLogin((v) => !v);
                setConfirmPassword('');
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
              className="text-primary font-body text-sm hover:underline"
            >
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            </button>
            {isLogin && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-muted-foreground font-body text-xs hover:text-foreground hover:underline transition-colors block mx-auto"
              >
                {t('auth.continueAsGuest')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
