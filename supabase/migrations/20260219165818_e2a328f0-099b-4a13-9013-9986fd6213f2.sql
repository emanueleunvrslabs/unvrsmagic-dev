-- Drop overly permissive public SELECT policies on profiles table
-- These expose all profile data (including phone numbers) to unauthenticated users
-- The secure SECURITY DEFINER functions (lookup_user_by_username, lookup_user_by_ref_code) 
-- are already in place for public lookups

DROP POLICY IF EXISTS "Anyone can lookup user_id by username" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can lookup user by ref_code" ON public.profiles;