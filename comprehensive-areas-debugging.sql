-- Comprehensive debugging to track exactly when areas table gets modified
-- This will help us identify the exact source of the overwrite issue

-- 1. Create a function to log all operations on areas table with detailed information
CREATE OR REPLACE FUNCTION log_detailed_areas_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the operation with detailed information
    INSERT INTO areas_audit_log (operation, user_id, old_data, new_data, client_info)
    VALUES (
        TG_OP,
        auth.uid(),
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('application_name', true) || ' | ' || current_setting('client_addr', true) || ' | ' || current_setting('session_user', true)
    );
    
    -- Also log to a separate detailed log table
    INSERT INTO areas_detailed_log (
        operation,
        user_id,
        timestamp,
        old_data,
        new_data,
        client_info,
        session_info,
        query_info
    ) VALUES (
        TG_OP,
        auth.uid(),
        NOW(),
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('application_name', true),
        current_setting('client_addr', true),
        current_query()
    );
    
    -- Return the appropriate record
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create detailed log table
CREATE TABLE IF NOT EXISTS areas_detailed_log (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB,
    client_info TEXT,
    session_info TEXT,
    query_info TEXT
);

-- 3. Drop existing triggers and create new detailed trigger
DROP TRIGGER IF EXISTS areas_audit_trigger ON areas;

CREATE TRIGGER areas_detailed_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION log_detailed_areas_changes();

-- 4. Grant permissions
GRANT SELECT ON areas_detailed_log TO authenticated;
GRANT ALL ON areas_detailed_log TO service_role;

-- 5. Add comment
COMMENT ON TABLE areas_detailed_log IS 'Detailed audit log for all operations on areas table';

-- 6. Check current areas data
SELECT 
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2,
    created_at
FROM areas 
ORDER BY "areaId"
LIMIT 10;

-- 7. Check if there are any existing audit entries
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

-- 8. Check if there are any existing detailed log entries
SELECT 
    operation,
    user_id,
    timestamp,
    old_data,
    new_data,
    client_info,
    session_info,
    query_info
FROM areas_detailed_log 
ORDER BY timestamp DESC 
LIMIT 10;

-- 9. Check if there are any triggers on areas table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas'
ORDER BY trigger_name;

-- 10. Check if there are any functions that might be updating areas
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%UPDATE areas%'
   OR routine_definition ILIKE '%INSERT INTO areas%'
   OR routine_definition ILIKE '%DELETE FROM areas%'
ORDER BY routine_name;
