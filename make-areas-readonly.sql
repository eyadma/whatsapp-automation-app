-- Make areas table read-only for normal users
-- Only admins should be able to modify the areas table

-- First, enable RLS on the areas table if not already enabled
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Areas are viewable by everyone" ON areas;
DROP POLICY IF EXISTS "Areas are insertable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are updatable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are deletable by admins only" ON areas;

-- Create policy for SELECT (everyone can read)
CREATE POLICY "Areas are viewable by everyone" ON areas
    FOR SELECT
    USING (true);

-- Create policy for INSERT (only admins can insert)
CREATE POLICY "Areas are insertable by admins only" ON areas
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create policy for UPDATE (only admins can update)
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

-- Create policy for DELETE (only admins can delete)
CREATE POLICY "Areas are deletable by admins only" ON areas
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT ON areas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON areas TO authenticated;

-- Add comment to document the policy
COMMENT ON TABLE areas IS 'Areas table - read-only for normal users, admin-only modifications';

-- Verify the policies
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
