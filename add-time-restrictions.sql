-- Add time restrictions feature to profiles table
-- This allows message sending between 09:00 AM and 12:30 PM Israel time
-- After 12:30 PM, users can only send if they used messaging during the allowed window

-- Add time restriction fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS time_restriction_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS time_restriction_start TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS time_restriction_end TIME DEFAULT '12:30:00',
ADD COLUMN IF NOT EXISTS time_restriction_timezone TEXT DEFAULT 'Asia/Jerusalem',
ADD COLUMN IF NOT EXISTS last_message_sent_during_window TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS daily_usage_tracked DATE DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_time_restriction ON profiles(time_restriction_enabled);

-- Create function to check if current time is within allowed hours (09:00-12:30)
CREATE OR REPLACE FUNCTION is_within_allowed_hours(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    current_time_local TIME;
    israel_time TIMESTAMPTZ;
BEGIN
    -- Get user's time restriction settings
    SELECT 
        time_restriction_enabled,
        time_restriction_start,
        time_restriction_end,
        time_restriction_timezone
    INTO user_profile
    FROM profiles 
    WHERE id = user_id;
    
    -- If time restriction is not enabled, allow sending always
    IF NOT user_profile.time_restriction_enabled THEN
        RETURN TRUE;
    END IF;
    
    -- Get current time in Israel timezone
    israel_time := NOW() AT TIME ZONE user_profile.time_restriction_timezone;
    current_time_local := israel_time::TIME;
    
    -- Check if current time is within allowed hours (09:00 to 12:30)
    RETURN current_time_local >= user_profile.time_restriction_start 
           AND current_time_local <= user_profile.time_restriction_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has used messaging during allowed hours today
CREATE OR REPLACE FUNCTION has_used_messaging_today(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    today_date DATE;
    israel_time TIMESTAMPTZ;
BEGIN
    -- Get user's time restriction settings and usage tracking
    SELECT 
        time_restriction_enabled,
        last_message_sent_during_window,
        daily_usage_tracked,
        time_restriction_timezone
    INTO user_profile
    FROM profiles 
    WHERE id = user_id;
    
    -- If time restriction is not enabled, always allow
    IF NOT user_profile.time_restriction_enabled THEN
        RETURN TRUE;
    END IF;
    
    -- Get today's date in Israel timezone
    israel_time := NOW() AT TIME ZONE user_profile.time_restriction_timezone;
    today_date := israel_time::DATE;
    
    -- Check if user has used messaging today during allowed hours
    RETURN user_profile.daily_usage_tracked = today_date 
           AND user_profile.last_message_sent_during_window IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to track message usage during allowed hours
CREATE OR REPLACE FUNCTION track_message_usage(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    today_date DATE;
    israel_time TIMESTAMPTZ;
BEGIN
    -- Get user's time restriction settings
    SELECT 
        time_restriction_enabled,
        time_restriction_timezone
    INTO user_profile
    FROM profiles 
    WHERE id = user_id;
    
    -- If time restriction is not enabled, no need to track
    IF NOT user_profile.time_restriction_enabled THEN
        RETURN TRUE;
    END IF;
    
    -- Get today's date in Israel timezone
    israel_time := NOW() AT TIME ZONE user_profile.time_restriction_timezone;
    today_date := israel_time::DATE;
    
    -- Update user's usage tracking
    UPDATE profiles 
    SET 
        last_message_sent_during_window = NOW(),
        daily_usage_tracked = today_date
    WHERE id = user_id;
    
    -- Return true if update was successful
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can send messages (new logic)
CREATE OR REPLACE FUNCTION can_send_messages(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- If user is within allowed hours (09:00-12:30), always allow sending
    IF is_within_allowed_hours(user_id) THEN
        RETURN TRUE;
    END IF;
    
    -- If user is outside allowed hours, check if they used messaging today during allowed window
    IF has_used_messaging_today(user_id) THEN
        RETURN TRUE;
    END IF;
    
    -- Deny sending if outside allowed hours and no usage today
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN profiles.time_restriction_enabled IS 'Whether time restrictions are enabled for this user';
COMMENT ON COLUMN profiles.time_restriction_start IS 'Start time for allowed message sending (24-hour format)';
COMMENT ON COLUMN profiles.time_restriction_end IS 'End time for allowed message sending (24-hour format)';
COMMENT ON COLUMN profiles.time_restriction_timezone IS 'Timezone for time restrictions (default: Asia/Jerusalem)';
COMMENT ON COLUMN profiles.last_message_sent_during_window IS 'When the user last sent a message during allowed hours';
COMMENT ON COLUMN profiles.daily_usage_tracked IS 'Date when user last used messaging during allowed hours';

COMMENT ON FUNCTION is_within_allowed_hours(UUID) IS 'Checks if current time is within user''s allowed hours (09:00-12:30)';
COMMENT ON FUNCTION has_used_messaging_today(UUID) IS 'Checks if user has used messaging during allowed hours today';
COMMENT ON FUNCTION track_message_usage(UUID) IS 'Tracks that user has sent a message during allowed hours';
COMMENT ON FUNCTION can_send_messages(UUID) IS 'Main function to check if user can send messages (allows 09:00-12:30 or if used messaging today)';
