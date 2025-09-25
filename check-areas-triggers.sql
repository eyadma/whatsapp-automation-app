-- Check for any triggers or functions that might be updating the areas table
-- This will help identify if there are any database-level operations causing the issue

-- Check for triggers on the areas table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'areas'
ORDER BY trigger_name;

-- Check for any functions that might be updating areas
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%areas%' 
   OR routine_definition ILIKE '%UPDATE%areas%'
   OR routine_definition ILIKE '%INSERT%areas%'
ORDER BY routine_name;

-- Check for any policies that might allow updates
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

-- Check recent changes to areas table (if audit logging is enabled)
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
ORDER BY created_at DESC 
LIMIT 20;

-- Check if there are any foreign key constraints that might be causing updates
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
