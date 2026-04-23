
CREATE OR REPLACE FUNCTION public.notify_reservation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  payload jsonb;
BEGIN
  edge_function_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/notify-reservation';
  service_role_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'reservations',
    'schema', 'public',
    'record', row_to_json(NEW)::jsonb
  );

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_reservation_insert
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.notify_reservation_webhook();
