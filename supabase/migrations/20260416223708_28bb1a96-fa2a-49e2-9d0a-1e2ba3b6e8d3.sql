CREATE OR REPLACE FUNCTION public.notify_push_on_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lnrnyahzkqqnvlpzrdlv.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', row_to_json(NEW)::jsonb),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_push_on_reservation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_reservation ON public.reservations;

CREATE TRIGGER trg_notify_push_on_reservation
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_reservation();