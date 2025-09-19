-- Fix time restrictions data issues
-- This script fixes the daily_usage_tracked field for users who have sent messages during allowed hours

-- First, let's see the current state
SELECT 
    id,
    email,
    time_restriction_enabled,
    time_restriction_start,
    time_restriction_end,
    last_message_sent_during_window,
    daily_usage_tracked
FROM profiles 
WHERE time_restriction_enabled = true;

-- Fix users who have last_message_sent_during_window but missing daily_usage_tracked
UPDATE profiles 
SET daily_usage_tracked = DATE(last_message_sent_during_window AT TIME ZONE time_restriction_timezone)
WHERE time_restriction_enabled = true 
  AND last_message_sent_during_window IS NOT NULL 
  AND daily_usage_tracked IS NULL;

-- Verify the fix
SELECT 
    id,
    email,
    time_restriction_enabled,
    last_message_sent_during_window,
    daily_usage_tracked,
    time_restriction_timezone
FROM profiles 
WHERE time_restriction_enabled = true;
