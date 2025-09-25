-- Fix duplicate foreign key constraints and ensure areas table protection
-- This will clean up the duplicate constraints that might be causing issues

-- First, let's see what constraints we have
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
    AND (tc.table_name = 'areas' OR ccu.table_name = 'areas')
ORDER BY tc.table_name, tc.constraint_name;

-- Remove duplicate foreign key constraints
-- Keep the camelCase version and remove the lowercase version

-- Remove duplicate customers constraints
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_areaid_fkey;

-- Remove duplicate locations constraints  
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_areaid_fkey;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_areaId_fkey1;

-- Verify the remaining constraints
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
    AND (tc.table_name = 'areas' OR ccu.table_name = 'areas')
ORDER BY tc.table_name, tc.constraint_name;

-- Now let's ensure the areas table is properly protected
-- Enable RLS if not already enabled
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Areas are viewable by everyone" ON areas;
DROP POLICY IF EXISTS "Areas are insertable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are updatable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are deletable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are read-only for normal users" ON areas;
DROP POLICY IF EXISTS "Areas are insertable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are updatable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are deletable by admins only" ON areas;

-- Create strict read-only policy for normal users
CREATE POLICY "Areas are read-only for normal users" ON areas
    FOR SELECT
    USING (true);

-- Create admin-only policies for modifications
CREATE POLICY "Areas are insertable by admins only" ON areas
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Areas are updatable by admins only" ON areas
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Areas are deletable by admins only" ON areas
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Revoke all permissions from authenticated users
REVOKE ALL ON areas FROM authenticated;

-- Grant only SELECT to authenticated users
GRANT SELECT ON areas TO authenticated;

-- Grant full permissions to service role (for admin operations)
GRANT ALL ON areas TO service_role;

-- Add a comment to document the protection
COMMENT ON TABLE areas IS 'PROTECTED: Areas table is read-only for normal users. Only admins can modify areas.';

-- Verify the final state
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
WHERE tablename = 'areas'
ORDER BY policyname;

-- Show final permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'areas'
ORDER BY grantee, privilege_type;
