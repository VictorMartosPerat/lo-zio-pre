-- Path traversal defense: reject ../  sequences and absolute paths in media.file_path.
-- Audit (pt_high_001) confirmed ../  sequences escape the storage router.
-- Defence-in-depth: even if storage layer is fixed by Supabase, DB rejects bad paths.

ALTER TABLE public.media
  ADD CONSTRAINT media_file_path_no_traversal
    CHECK (
      file_path !~ '\.\.[/\\]'         -- no ../ or ..\
      AND file_path !~ '^/'            -- no absolute paths
      AND file_path ~ '^[a-zA-Z0-9_./ -]+$'  -- allowlist: alphanumeric, dots, slashes, hyphens, spaces
    );
