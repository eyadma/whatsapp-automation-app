-- EMERGENCY: Complete lockdown of areas table
-- This will prevent ANY modifications to the areas table except by admins

-- First, disable all existing policies
DROP POLICY IF EXISTS "Areas are viewable by everyone" ON areas;
DROP POLICY IF EXISTS "Areas are insertable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are updatable by admins only" ON areas;
DROP POLICY IF EXISTS "Areas are deletable by admins only" ON areas;

-- Enable RLS
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

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

-- Add a comment to document the lockdown
COMMENT ON TABLE areas IS 'EMERGENCY LOCKDOWN: Areas table is completely read-only for normal users. Only admins can modify areas.';

-- Create a function to log any attempted modifications
CREATE OR REPLACE FUNCTION log_areas_modification_attempt()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the attempt
    INSERT INTO audit_log (table_name, operation, user_id, timestamp, old_data, new_data)
    VALUES (
        'areas',
        TG_OP,
        auth.uid(),
        NOW(),
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END
    );
    
    -- If user is not admin, prevent the operation
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Areas table is read-only for normal users. Only admins can modify areas.';
    END IF;
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB
);

-- Create triggers to log all modification attempts
DROP TRIGGER IF EXISTS areas_insert_trigger ON areas;
DROP TRIGGER IF EXISTS areas_update_trigger ON areas;
DROP TRIGGER IF EXISTS areas_delete_trigger ON areas;

CREATE TRIGGER areas_insert_trigger
    BEFORE INSERT ON areas
    FOR EACH ROW
    EXECUTE FUNCTION log_areas_modification_attempt();

CREATE TRIGGER areas_update_trigger
    BEFORE UPDATE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION log_areas_modification_attempt();

CREATE TRIGGER areas_delete_trigger
    BEFORE DELETE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION log_areas_modification_attempt();

-- Verify the lockdown
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

-- Show current permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'areas'
ORDER BY grantee, privilege_type;
