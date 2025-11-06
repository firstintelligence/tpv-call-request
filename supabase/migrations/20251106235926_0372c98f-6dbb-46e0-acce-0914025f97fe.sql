-- Drop existing permissive RLS policies
DROP POLICY IF EXISTS "Anyone can view TPV requests" ON public.tpv_requests;
DROP POLICY IF EXISTS "Anyone can insert TPV requests" ON public.tpv_requests;
DROP POLICY IF EXISTS "Anyone can update TPV requests" ON public.tpv_requests;

-- The edge functions will use service_role key which bypasses RLS
-- No additional policies needed as this is a backend-only table accessed via edge functions