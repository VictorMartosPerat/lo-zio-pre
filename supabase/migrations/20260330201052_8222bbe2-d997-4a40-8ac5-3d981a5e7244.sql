
-- Create public storage bucket for media (photos and videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  104857600, -- 100MB limit for videos
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Allow anyone to view files in the media bucket
CREATE POLICY "Public read access for media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Allow admins to upload files
CREATE POLICY "Admins can upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update files
CREATE POLICY "Admins can update media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to delete files
CREATE POLICY "Admins can delete media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create media table to track files and their associations
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'image', -- 'image' or 'video'
  media_category text NOT NULL, -- 'menu_item', 'location', 'background_video'
  reference_key text, -- menu item name or location slug
  alt_text text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media
CREATE POLICY "Anyone can view media" ON public.media
  FOR SELECT USING (true);

-- Admins can manage media
CREATE POLICY "Admins can insert media" ON public.media
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update media" ON public.media
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete media" ON public.media
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
