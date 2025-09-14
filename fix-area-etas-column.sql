-- Fix area_etas table to include the missing 'eta' column
-- This script adds the column that the application code expects

-- Add the missing 'eta' column to area_etas table
ALTER TABLE public.area_etas 
ADD COLUMN IF NOT EXISTS eta TEXT;

-- Update any existing rows to have a default ETA value if they don't have one
-- This is optional - you can remove this if you want to handle it manually
UPDATE public.area_etas 
SET eta = COALESCE(eta, 'No ETA set')
WHERE eta IS NULL;

-- Verify the fix
SELECT 
  'area_etas table structure:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'area_etas'
ORDER BY ordinal_position;

-- Test that the column exists and can be queried
SELECT 
  'Testing eta column access...' as test,
  COUNT(*) as total_etas,
  COUNT(eta) as etas_with_value
FROM public.area_etas;
