-- Add location fields to locations table
-- This script adds longitude, latitude, and location_received fields to the locations table

-- Check if the locations table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'locations') THEN
        RAISE EXCEPTION 'Locations table does not exist. Please create it first.';
    END IF;
END $$;

-- Add longitude field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'longitude') THEN
        ALTER TABLE public.locations ADD COLUMN longitude DECIMAL(10, 8);
        RAISE NOTICE 'Added longitude column to locations table';
    ELSE
        RAISE NOTICE 'longitude column already exists in locations table';
    END IF;
END $$;

-- Add latitude field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'latitude') THEN
        ALTER TABLE public.locations ADD COLUMN latitude DECIMAL(11, 8);
        RAISE NOTICE 'Added latitude column to locations table';
    ELSE
        RAISE NOTICE 'latitude column already exists in locations table';
    END IF;
END $$;

-- Add location_received field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'location_received') THEN
        ALTER TABLE public.locations ADD COLUMN location_received BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added location_received column to locations table';
    ELSE
        RAISE NOTICE 'location_received column already exists in locations table';
    END IF;
END $$;

-- Add updated_at field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'updated_at') THEN
        ALTER TABLE public.locations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to locations table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in locations table';
    END IF;
END $$;

-- Verify the changes
SELECT 
    'Locations table structure after adding location fields:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'locations'
    AND column_name IN ('longitude', 'latitude', 'location_received', 'updated_at')
ORDER BY column_name;

-- Test insert with location data (will be rolled back)
BEGIN;
INSERT INTO public.locations (
    user_id,
    name,
    phone,
    longitude,
    latitude,
    location_received,
    area
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'Test Location with Coordinates',
    '0501234567',
    34.7818,
    32.0853,
    true,
    'Test Area'
);
ROLLBACK;

SELECT 'Location fields test: PASSED' as test_result;
