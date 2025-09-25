-- Fix the areas_duplicate table issue
-- This table might be the source of the areas table overwrite problem

-- 1. First, let's see what's in the areas_duplicate table
SELECT 
    'areas_duplicate' as table_name,
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2,
    created_at
FROM areas_duplicate 
ORDER BY "areaId"
LIMIT 10;

-- 2. Check if there are any triggers that might be copying data from areas_duplicate to areas
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas_duplicate'
   OR action_statement ILIKE '%areas_duplicate%'
   OR action_statement ILIKE '%areas%'
ORDER BY trigger_name;

-- 3. Check if there are any functions that might be syncing data between tables
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%areas_duplicate%'
   OR routine_definition ILIKE '%INSERT INTO areas%'
   OR routine_definition ILIKE '%UPDATE areas%'
ORDER BY routine_name;

-- 4. Check if there are any policies that might allow operations on areas_duplicate
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

-- 5. Check if there are any foreign key constraints that might be causing issues
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

-- 6. If areas_duplicate is causing the issue, we should either:
--    a) Delete it if it's not needed
--    b) Protect it if it's needed
--    c) Fix any triggers/functions that are using it

-- Let's check if areas_duplicate is being used by any other tables
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%area%'
   AND table_name != 'areas'
   AND table_name != 'areas_duplicate'
ORDER BY table_name, column_name;

-- 7. Check if there are any active queries involving areas_duplicate
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

-- 8. If we need to delete areas_duplicate (if it's not needed):
-- DROP TABLE IF EXISTS areas_duplicate CASCADE;

-- 9. If we need to protect areas_duplicate (if it's needed):
-- ALTER TABLE areas_duplicate ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Areas duplicate is read-only" ON areas_duplicate FOR SELECT USING (true);
-- CREATE POLICY "Areas duplicate is admin-only for modifications" ON areas_duplicate 
--     FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 10. Check if there are any other tables that might be causing the issue
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%area%'
ORDER BY table_name;
