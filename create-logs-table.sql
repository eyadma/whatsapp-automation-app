-- Create logs table for database logging
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug', 'trace')),
    category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_logs_user_timestamp ON logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_session_timestamp ON logs(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_category_timestamp ON logs(category, timestamp);

-- Create partial indexes for error logs (most important)
CREATE INDEX IF NOT EXISTS idx_logs_errors ON logs(timestamp) WHERE level = 'error';
CREATE INDEX IF NOT EXISTS idx_logs_connection_errors ON logs(timestamp) WHERE level = 'error' AND category = 'connection';

-- Enable Row Level Security (RLS)
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own logs
CREATE POLICY "Users can view their own logs" ON logs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert their own logs" ON logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for server-side logging)
CREATE POLICY "Service role can do everything" ON logs
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to clean up old logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_logs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get log statistics
CREATE OR REPLACE FUNCTION get_log_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'by_level', json_object_agg(level, level_count),
        'by_category', json_object_agg(category, category_count),
        'recent_errors', (
            SELECT COUNT(*) 
            FROM logs 
            WHERE level = 'error' 
            AND created_at > NOW() - INTERVAL '1 hour'
        ),
        'recent_logs', (
            SELECT COUNT(*) 
            FROM logs 
            WHERE created_at > NOW() - INTERVAL '1 hour'
        )
    ) INTO result
    FROM (
        SELECT 
            level,
            COUNT(*) as level_count
        FROM logs 
        GROUP BY level
    ) level_stats
    CROSS JOIN (
        SELECT 
            category,
            COUNT(*) as category_count
        FROM logs 
        GROUP BY category
    ) category_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for recent logs (last 24 hours)
CREATE OR REPLACE VIEW recent_logs AS
SELECT 
    id,
    level,
    category,
    message,
    data,
    user_id,
    session_id,
    timestamp,
    created_at
FROM logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Grant permissions
GRANT SELECT ON recent_logs TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_log_stats() TO authenticated, service_role;

-- Create a trigger to automatically clean up old logs (optional)
-- This will run daily and clean up logs older than 30 days
-- Uncomment if you want automatic cleanup
/*
CREATE OR REPLACE FUNCTION auto_cleanup_logs()
RETURNS void AS $$
BEGIN
    PERFORM cleanup_old_logs(30);
END;
$$ LANGUAGE plpgsql;

-- You would need to set up a cron job or scheduled task to call this function
-- For example, using pg_cron extension if available:
-- SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT auto_cleanup_logs();');
*/
