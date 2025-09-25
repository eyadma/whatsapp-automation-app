-- Check the data in areas_duplicate table to see if it's causing the overwrite issue
-- This will help us understand what's in the duplicate table and if it's the source of the problem

-- 1. Check the structure of areas_duplicate table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'areas_duplicate'
ORDER BY ordinal_position;

-- 2. Check the data in areas_duplicate table
SELECT 
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2,
    created_at
FROM areas_duplicate 
ORDER BY "areaId"
LIMIT 20;

-- 3. Check the data in the main areas table
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
LIMIT 20;

-- 4. Compare the data between both tables
SELECT 
    'areas' as table_name,
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2
FROM areas 
WHERE "areaId" IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
UNION ALL
SELECT 
    'areas_duplicate' as table_name,
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2
FROM areas_duplicate 
WHERE "areaId" IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
ORDER BY "areaId", table_name;

-- 5. Check if there are any triggers on areas_duplicate table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas_duplicate'
ORDER BY trigger_name;

-- 6. Check if there are any functions that might be syncing data
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%areas_duplicate%'
   OR routine_definition ILIKE '%INSERT INTO areas%'
   OR routine_definition ILIKE '%UPDATE areas%'
ORDER BY routine_name;

-- 7. Check if there are any policies on areas_duplicate
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

-- 8. Check if there are any foreign key constraints
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
    AND (tc.table_name = 'areas_duplicate' OR ccu.table_name = 'areas_duplicate')
ORDER BY tc.table_name, tc.constraint_name;

-- 9. Check if there are any recent operations on areas_duplicate
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE query ILIKE '%areas_duplicate%'
   OR query ILIKE '%INSERT INTO areas%'
   OR query ILIKE '%UPDATE areas%'
ORDER BY query_start DESC;

-- 10. Check the audit log to see if there are any recent operations
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
