-- Fix duplicate Hebrew names in areas table
-- This script identifies and fixes areas where Hebrew names are the same as English names

-- First, let's see what areas have duplicate names
SELECT 
    areaId,
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
ORDER BY areaId;

-- Fix specific problematic areas
-- Area 967: جديرا جنوب (should have proper Hebrew translation)
UPDATE areas 
SET name_hebrew = 'גדירה דרום'
WHERE areaId = 967 AND name_english = 'جديرا جنوب';

-- Add more fixes for other areas with duplicate names
-- You can add more UPDATE statements here for other problematic areas

-- Verify the fixes
SELECT 
    areaId,
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
WHERE areaId = 967;
