-- Fix infinite recursion in profiles RLS policies
-- This script fixes the circular dependency issue in the profiles table policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a simpler, non-recursive policy for admins
-- This policy allows users to view all profiles if they have admin role
-- We'll use a different approach that doesn't cause recursion
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    -- Check if the current user's role is admin by looking at their own profile
    -- This avoids the circular reference
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    -- Same approach for update policy
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Alternative approach: Create a function to check admin status
-- This is more efficient and avoids potential recursion issues
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old policies and recreate with the function
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create new policies using the function
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Also fix the foreign key constraint issue for customers table
-- First, let's check if the constraint exists and drop it if it references the wrong table
DO $$
BEGIN
  -- Check if the constraint exists and references customer_areas instead of areas
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'customers' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'customers_areaid_fkey'
  ) THEN
    -- Drop the incorrect constraint
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_areaid_fkey;
    
    -- Add the correct constraint referencing the areas table
    ALTER TABLE customers 
    ADD CONSTRAINT customers_areaid_fkey 
    FOREIGN KEY ("areaId") REFERENCES areas("areaId");
    
    RAISE NOTICE 'Fixed foreign key constraint: customers_areaid_fkey now references areas table';
  ELSE
    RAISE NOTICE 'Foreign key constraint customers_areaid_fkey not found or already correct';
  END IF;
END $$;

-- Ensure the areas table exists with the correct structure
CREATE TABLE IF NOT EXISTS public.areas (
  "areaId" text PRIMARY KEY,
  name_english text,
  name_hebrew text,
  name_arabic text,
  preferred_language_1 text,
  preferred_language_2 text,
  created_at timestamptz DEFAULT now()
);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_areas_name_english ON public.areas(name_english);

-- Enable RLS on areas table if not already enabled
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for areas table (allow all users to read areas)
DROP POLICY IF EXISTS "Anyone can view areas" ON public.areas;
CREATE POLICY "Anyone can view areas" ON public.areas
  FOR SELECT USING (true);

-- Only admins can modify areas
DROP POLICY IF EXISTS "Admins can manage areas" ON public.areas;
CREATE POLICY "Admins can manage areas" ON public.areas
  FOR ALL USING (is_admin());

-- Verify the fix by testing the policies
-- This query should work without infinite recursion
SELECT 
  'Testing profiles access...' as test,
  COUNT(*) as total_profiles
FROM profiles;

-- Test admin function
SELECT 
  'Testing admin function...' as test,
  is_admin() as current_user_is_admin;

-- Test areas table access
SELECT 
  'Testing areas access...' as test,
  COUNT(*) as total_areas
FROM areas;
