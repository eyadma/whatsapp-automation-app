-- Simple script to protect areas table without recreating existing policies
-- This will just ensure the areas table is properly protected

-- First, let's see what policies currently exist
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'areas'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'areas';

-- Check current permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'areas'
ORDER BY grantee, privilege_type;

-- If RLS is not enabled, enable it
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Ensure we have the basic policies (only create if they don't exist)
-- Read policy for all users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'areas' 
        AND policyname = 'Areas are read-only for normal users'
    ) THEN
        CREATE POLICY "Areas are read-only for normal users" ON areas
            FOR SELECT
            USING (true);
    END IF;
END $$;

-- Admin-only insert policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'areas' 
        AND policyname = 'Areas are insertable by admins only'
    ) THEN
        CREATE POLICY "Areas are insertable by admins only" ON areas
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- Admin-only update policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'areas' 
        AND policyname = 'Areas are updatable by admins only'
    ) THEN
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
    END IF;
END $$;

-- Admin-only delete policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'areas' 
        AND policyname = 'Areas are deletable by admins only'
    ) THEN
        CREATE POLICY "Areas are deletable by admins only" ON areas
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- Set permissions
REVOKE ALL ON areas FROM authenticated;
GRANT SELECT ON areas TO authenticated;
GRANT ALL ON areas TO service_role;

-- Final verification
SELECT 
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'areas'
ORDER BY policyname;
