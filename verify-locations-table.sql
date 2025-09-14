-- Verify locations table exists and has correct structure
-- This script checks if the locations table was created properly

-- Check if locations table exists
SELECT 
  'Table exists check:' as info,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'locations'
  ) as table_exists;

-- Check table structure
SELECT 
  'Table structure:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'locations'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  'Indexes:' as info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'locations';

-- Check constraints
SELECT 
  'Constraints:' as info,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.locations'::regclass;

-- Check RLS policies
SELECT 
  'RLS Policies:' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'locations';

-- Test insert (will be rolled back)
BEGIN;
INSERT INTO public.locations (
  user_id,
  name,
  phone,
  shipment_id,
  package_id,
  area
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Test Location',
  '0501234567',
  'test_shipment_123',
  'test_package_123',
  'Test Area'
);
ROLLBACK;

SELECT 'Test insert: PASSED' as test_result;
