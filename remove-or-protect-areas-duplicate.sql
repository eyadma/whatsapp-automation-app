-- Remove or protect the areas_duplicate table
-- This will help prevent the areas table overwrite issue

-- First, let's check if areas_duplicate is being used by any other tables
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%area%'
   AND table_name != 'areas'
   AND table_name != 'areas_duplicate'
ORDER BY table_name, column_name;

-- Check if there are any foreign key constraints pointing to areas_duplicate
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'areas_duplicate'
ORDER BY tc.table_name, tc.constraint_name;

-- If no other tables are using areas_duplicate, we can safely remove it
-- But first, let's backup the data just in case

-- Create a backup table
CREATE TABLE IF NOT EXISTS areas_duplicate_backup AS 
SELECT * FROM areas_duplicate;

-- Add a comment to the backup table
COMMENT ON TABLE areas_duplicate_backup IS 'Backup of areas_duplicate table before removal';

-- Now we have two options:

-- OPTION 1: Remove areas_duplicate table completely (if it's not needed)
-- This will prevent any triggers or functions from using it
/*
DROP TABLE IF EXISTS areas_duplicate CASCADE;
*/

-- OPTION 2: Protect areas_duplicate table (if it's needed for some reason)
-- This will make it read-only for normal users
/*
-- Enable RLS on areas_duplicate
ALTER TABLE areas_duplicate ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Areas duplicate is read-only" ON areas_duplicate;
DROP POLICY IF EXISTS "Areas duplicate is admin-only for modifications" ON areas_duplicate;

-- Create read-only policy for normal users
CREATE POLICY "Areas duplicate is read-only" ON areas_duplicate
    FOR SELECT
    USING (true);

-- Create admin-only policy for modifications
CREATE POLICY "Areas duplicate is admin-only for modifications" ON areas_duplicate
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Revoke all permissions from authenticated users
REVOKE ALL ON areas_duplicate FROM authenticated;

-- Grant only SELECT to authenticated users
GRANT SELECT ON areas_duplicate TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON areas_duplicate TO service_role;

-- Add comment
COMMENT ON TABLE areas_duplicate IS 'Protected areas_duplicate table - read-only for normal users';
*/

-- For now, let's just add protection without removing the table
-- This will prevent any modifications while we investigate further

-- Enable RLS on areas_duplicate
ALTER TABLE areas_duplicate ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Areas duplicate is read-only" ON areas_duplicate;
DROP POLICY IF EXISTS "Areas duplicate is admin-only for modifications" ON areas_duplicate;

-- Create read-only policy for normal users
CREATE POLICY "Areas duplicate is read-only" ON areas_duplicate
    FOR SELECT
    USING (true);

-- Create admin-only policy for modifications
CREATE POLICY "Areas duplicate is admin-only for modifications" ON areas_duplicate
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Revoke all permissions from authenticated users
REVOKE ALL ON areas_duplicate FROM authenticated;

-- Grant only SELECT to authenticated users
GRANT SELECT ON areas_duplicate TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON areas_duplicate TO service_role;

-- Add comment
COMMENT ON TABLE areas_duplicate IS 'Protected areas_duplicate table - read-only for normal users';

-- Verify the protection
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'areas_duplicate'
ORDER BY policyname;

-- Show final permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'areas_duplicate'
ORDER BY grantee, privilege_type;
