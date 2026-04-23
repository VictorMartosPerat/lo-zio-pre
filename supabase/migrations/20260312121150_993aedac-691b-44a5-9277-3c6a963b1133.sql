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

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'notify_reservation_webhook skipped: missing backend URL or service key secret';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_reservation_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$$;