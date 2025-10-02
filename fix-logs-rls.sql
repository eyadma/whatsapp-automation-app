-- Fix RLS policies for logs table
-- This script can be run to fix the RLS issue

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own logs" ON logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON logs;
DROP POLICY IF EXISTS "Service role can do everything" ON logs;
DROP POLICY IF EXISTS "Server logging without user context" ON logs;

-- Disable RLS temporarily for easier setup
ALTER TABLE logs DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with proper policies
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create more permissive policies
CREATE POLICY "Allow all operations for service role" ON logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow server logging" ON logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own logs" ON logs
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
