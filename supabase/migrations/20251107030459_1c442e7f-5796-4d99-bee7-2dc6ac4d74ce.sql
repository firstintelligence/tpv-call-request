-- Add recording_url column to tpv_requests table
ALTER TABLE public.tpv_requests 
ADD COLUMN recording_url text;