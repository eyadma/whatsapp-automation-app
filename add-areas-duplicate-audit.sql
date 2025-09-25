-- Add audit logging to areas_duplicate table to track operations
-- This will help identify if areas_duplicate is being modified and causing the issue

-- Create audit log table for areas_duplicate if it doesn't exist
CREATE TABLE IF NOT EXISTS areas_duplicate_audit_log (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB,
    client_info TEXT
);

-- Create function to log areas_duplicate modifications
CREATE OR REPLACE FUNCTION log_areas_duplicate_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the operation
    INSERT INTO areas_duplicate_audit_log (operation, user_id, old_data, new_data, client_info)
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
DROP TRIGGER IF EXISTS areas_duplicate_audit_trigger ON areas_duplicate;

-- Create the audit trigger
CREATE TRIGGER areas_duplicate_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON areas_duplicate
    FOR EACH ROW
    EXECUTE FUNCTION log_areas_duplicate_changes();

-- Grant permissions
GRANT SELECT ON areas_duplicate_audit_log TO authenticated;
GRANT ALL ON areas_duplicate_audit_log TO service_role;

-- Add comment
COMMENT ON TABLE areas_duplicate_audit_log IS 'Audit log for all operations on areas_duplicate table';

-- Check if there are any existing audit entries
SELECT 
    operation,
    user_id,
    timestamp,
    old_data,
    new_data,
    client_info
FROM areas_duplicate_audit_log 
ORDER BY timestamp DESC 
LIMIT 10;
