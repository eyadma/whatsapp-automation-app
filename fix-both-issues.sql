-- Comprehensive fix for both time restrictions and areas issues
-- Run this script in your Supabase SQL Editor

-- ========================================
-- 1. FIX TIME RESTRICTIONS DATA
-- ========================================

-- Fix users who have last_message_sent_during_window but missing daily_usage_tracked
UPDATE profiles 
SET daily_usage_tracked = DATE(last_message_sent_during_window AT TIME ZONE time_restriction_timezone)
WHERE time_restriction_enabled = true 
  AND last_message_sent_during_window IS NOT NULL 
  AND daily_usage_tracked IS NULL;

-- ========================================
-- 2. FIX AREAS DUPLICATE NAMES
-- ========================================

-- Fix area 967: جديرا جنوب (should have proper Hebrew translation)
UPDATE areas 
SET name_hebrew = 'גדירה דרום'
WHERE "areaId" = 967 AND name_english = 'جديرا جنوب';

-- Fix other common duplicate name issues
-- Add more fixes here as needed

-- ========================================
-- 3. VERIFY FIXES
-- ========================================

-- Check time restrictions data
SELECT 
    'TIME RESTRICTIONS' as fix_type,
    id,
    email,
    time_restriction_enabled,
    last_message_sent_during_window,
    daily_usage_tracked,
    time_restriction_timezone
FROM profiles 
WHERE time_restriction_enabled = true;

-- Check areas data
SELECT 
    'AREAS' as fix_type,
    "areaId",
    name_english,
    name_hebrew,
    name_arabic,
    CASE 
        WHEN name_hebrew = name_english THEN 'Hebrew = English'
        WHEN name_arabic = name_english THEN 'Arabic = English'
        WHEN name_hebrew = name_arabic THEN 'Hebrew = Arabic'
        ELSE 'OK'
    END as issue_type
FROM areas 
WHERE name_hebrew = name_english 
   OR name_arabic = name_english 
   OR name_hebrew = name_arabic
ORDER BY "areaId";
