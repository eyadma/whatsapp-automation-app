-- Test script to verify areas table protection
-- This will test if the areas table is properly protected from unauthorized modifications

-- First, let's check what policies currently exist
SELECT 
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'areas'
ORDER BY policyname;

-- Test 1: Try to select from areas (should work for all users)
SELECT 
    "areaId",
    name_arabic,
    name_english,
    name_hebrew,
    preferred_language_1,
    preferred_language_2
FROM areas 
LIMIT 5;

-- Test 2: Try to insert a new area (should fail for normal users)
-- This will show an error if the protection is working
INSERT INTO areas ("areaId", name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2)
VALUES (99999, 'Test Arabic', 'Test English', 'Test Hebrew', 'ar', 'en');

-- Test 3: Try to update an existing area (should fail for normal users)
-- This will show an error if the protection is working
UPDATE areas 
SET name_arabic = 'Modified Arabic'
WHERE "areaId" = 1;

-- Test 4: Try to delete an area (should fail for normal users)
-- This will show an error if the protection is working
DELETE FROM areas 
WHERE "areaId" = 99999;

-- If all tests show errors, the protection is working correctly!
-- If any test succeeds, there's still an issue with the protection.
