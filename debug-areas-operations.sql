-- Comprehensive debugging script to track all operations on areas table
-- This will help identify what's modifying the areas table

-- 1. Check for any triggers on areas table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas'
ORDER BY trigger_name;

-- 2. Check for any functions that might be updating areas
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%areas%' 
   OR routine_definition ILIKE '%UPDATE%areas%'
   OR routine_definition ILIKE '%INSERT%areas%'
   OR routine_definition ILIKE '%DELETE%areas%'
ORDER BY routine_name;

-- 3. Check for any policies that might allow updates
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

-- 4. Check current areas data to see what's in the table
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

-- 5. Check for any foreign key constraints that might be causing updates
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

-- 6. Check if there are any active connections or sessions that might be modifying data
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
   OR query ILIKE '%UPDATE%areas%'
   OR query ILIKE '%INSERT%areas%'
   OR query ILIKE '%DELETE%areas%'
ORDER BY query_start DESC;

-- 7. Check for any recent changes to areas (if audit logging exists)
-- This might show what's been updating the areas
SELECT 
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2,
    created_at
FROM areas 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 8. Check if there are any other tables that might be referencing areas
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%area%'
   AND table_name != 'areas'
ORDER BY table_name, column_name;
