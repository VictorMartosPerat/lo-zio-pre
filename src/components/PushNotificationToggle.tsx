import { useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const PushNotificationToggle = () => {
  const { status, busy, supported, enablePush, disablePush } = usePushSubscription();
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="w-4 h-4" />
        Notificaciones no soportadas en este navegador
      </div>
    );
  }

  const handleEnable = async () => {
    const ok = await enablePush();
    if (ok) {
      toast.success('Dispositivo sincronizado', {
        description: 'Este dispositivo ya recibirá las nuevas reservas.',
      });
    } else if (status === 'denied') {
      toast.error('Permiso denegado', {
        description: 'Los permisos de notificaciones están bloqueados en este dispositivo.',
      });
    } else {
      toast.error('No se pudo activar', { description: 'Inténtalo de nuevo.' });
    }
  };

  const handleDisable = async () => {
    const ok = await disablePush();
    if (ok) toast.info('Notificaciones desactivadas');
  };

  const handleTest = async () => {
    if (!user) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      const sent = (data as { sent?: number })?.sent ?? 0;
      if (sent > 0) {
        toast.success(`Prueba enviada (${sent} dispositivo${sent > 1 ? 's' : ''})`, {
          description: 'Debería llegarte en unos segundos.',
        });
      } else {
        toast.error('No hay suscripciones registradas', {
          description: 'Pulsa "Reactivar" antes de probar.',
        });
      }
    } catch (err) {
      console.error('[Push] test error:', err);
      toast.error('Error enviando la prueba');
    } finally {
      setTesting(false);
    }
  };

  if (status === 'granted-subscribed') {
    return (
      <div className="flex flex-col gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Notificaciones activas</p>
              <p className="text-xs text-muted-foreground">
                Recibirás avisos de nuevas reservas en este dispositivo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleEnable} disabled={busy}>
              {busy ? '…' : 'Reactivar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDisable} disabled={busy}>
              Desactivar
            </Button>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Enviando…' : '🔔 Enviar notificación de prueba'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2">
        {status === 'denied' ? (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Bell className="w-5 h-5 text-muted-foreground" />
        )}
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            {status === 'denied' ? 'Reactivar notificaciones' : 'Activar notificaciones'}
          </p>
          <p className="text-xs text-muted-foreground">
            Imprescindible en iOS/Android para recibir reservas con la app cerrada.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={handleEnable} disabled={busy}>
        {busy ? 'Activando…' : status === 'denied' ? 'Reactivar' : 'Activar'}
      </Button>
    </div>
  );
};

export default PushNotificationToggle;
