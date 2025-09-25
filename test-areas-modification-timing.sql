-- Test to see exactly when the areas table gets modified
-- This will help us identify the timing of the modifications

-- 1. First, let's check the current state of the areas table
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

-- 2. Check if there are any recent operations in the audit log
SELECT 
    operation,
    user_id,
    timestamp,
    old_data,
    new_data,
    client_info
FROM areas_audit_log 
ORDER BY timestamp DESC 
LIMIT 20;

-- 3. Check if there are any active connections that might be modifying data
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE query ILIKE '%areas%'
   OR query ILIKE '%UPDATE%'
   OR query ILIKE '%INSERT%'
   OR query ILIKE '%DELETE%'
ORDER BY query_start DESC;

-- 4. Check if there are any triggers that might be running
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas'
ORDER BY trigger_name;

-- 5. Check if there are any functions that might be called
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%areas%'
   AND routine_definition ILIKE '%UPDATE%'
ORDER BY routine_name;

-- 6. Check if there are any policies that might allow updates
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

-- 7. Check if there are any foreign key constraints that might be causing updates
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

-- 8. Check if there are any other tables that might be affecting areas
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%area%'
   AND table_name != 'areas'
   AND table_name != 'areas_duplicate'
   AND table_name != 'areas_audit_log'
ORDER BY table_name, column_name;

-- 9. Check if there are any views that might be affecting areas
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%area%'
ORDER BY table_name;

-- 10. Check if there are any materialized views
SELECT 
    schemaname,
    matviewname,
    definition
FROM pg_matviews 
WHERE matviewname ILIKE '%area%';
