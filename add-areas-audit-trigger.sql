-- Add audit trigger to track all operations on areas table
-- This will help identify what's modifying the areas table

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS areas_audit_log (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB,
    client_info TEXT
);

-- Create function to log areas modifications
CREATE OR REPLACE FUNCTION log_areas_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the operation
    INSERT INTO areas_audit_log (operation, user_id, old_data, new_data, client_info)
    VALUES (
        TG_OP,
        auth.uid(),
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('application_name', true)
    );
    
    -- Return the appropriate record
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS areas_audit_trigger ON areas;

-- Create the audit trigger
CREATE TRIGGER areas_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION log_areas_changes();

-- Grant permissions
GRANT SELECT ON areas_audit_log TO authenticated;
GRANT ALL ON areas_audit_log TO service_role;

-- Add comment
COMMENT ON TABLE areas_audit_log IS 'Audit log for all operations on areas table';

-- Test the trigger by checking recent audit entries
SELECT 
    operation,
    user_id,
    timestamp,
    old_data,
    new_data,
    client_info
FROM areas_audit_log 
ORDER BY timestamp DESC 
LIMIT 10;
