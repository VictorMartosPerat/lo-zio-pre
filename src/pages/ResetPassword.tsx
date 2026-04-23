import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoZio from '@/assets/logozio.png';
import heroPizza from "@/assets/fondopizza.jpg";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check hash for recovery tokens (from email link)
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check current session - if user landed here with a valid session, show password form
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && hash.includes('type=recovery')) {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.resetLinkSent'));
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error(t('profile.passwordTooShort')); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(t('auth.passwordResetError'));
    } else {
      toast.success(t('auth.passwordResetSuccess'));
      navigate('/auth');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
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
            {isRecovery ? t('auth.resetPasswordTitle') : t('auth.forgotPasswordTitle')}
          </p>
        </div>

        <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
          {isRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <p className="text-muted-foreground font-body text-sm">{t('auth.resetPasswordDesc')}</p>
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t('auth.password')}</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-sm bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••" minLength={6} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 min-h-[48px] rounded-sm font-body font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? t('auth.loading') : t('auth.resetPassword')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendReset} className="space-y-5">
              <p className="text-muted-foreground font-body text-sm">{t('auth.forgotPasswordDesc')}</p>
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t('auth.email')}</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-sm bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="tu@email.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 min-h-[48px] rounded-sm font-body font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? t('auth.loading') : t('auth.sendResetLink')}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button onClick={() => navigate('/auth')} className="text-primary font-body text-sm hover:underline">
              {t('auth.hasAccount')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
