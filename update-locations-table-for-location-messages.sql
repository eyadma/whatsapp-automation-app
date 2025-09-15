-- Update locations table to support location message listener
-- This script adds the required columns for location message processing

-- Check if locations table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'locations') THEN
        -- Create locations table if it doesn't exist
        CREATE TABLE public.locations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT,
            phone TEXT,
            shipment_id TEXT,
            package_id TEXT,
            area TEXT,
            package_price DECIMAL(10,2),
            has_return BOOLEAN DEFAULT false,
            business_name TEXT,
            tracking_number TEXT,
            whatsapp_message TEXT,
            items_description TEXT,
            quantity INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created locations table';
    ELSE
        RAISE NOTICE 'Locations table already exists';
    END IF;
END $$;

-- Add location-related columns if they don't exist
DO $$
BEGIN
    -- Add longitude column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'longitude') THEN
        ALTER TABLE public.locations ADD COLUMN longitude DECIMAL(10, 8);
        RAISE NOTICE 'Added longitude column';
    END IF;
    
    -- Add latitude column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'latitude') THEN
        ALTER TABLE public.locations ADD COLUMN latitude DECIMAL(11, 8);
        RAISE NOTICE 'Added latitude column';
    END IF;
    
    -- Add location_received column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'location_received') THEN
        ALTER TABLE public.locations ADD COLUMN location_received BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added location_received column';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_phone ON public.locations(phone);
CREATE INDEX IF NOT EXISTS idx_locations_location_received ON public.locations(location_received);

-- Enable RLS (Row Level Security)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
    -- Policy for users to see only their own locations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Users can view their own locations') THEN
        CREATE POLICY "Users can view their own locations" ON public.locations
            FOR SELECT USING (auth.uid() = user_id);
        RAISE NOTICE 'Created SELECT policy for locations';
    END IF;
    
    -- Policy for users to insert their own locations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Users can insert their own locations') THEN
        CREATE POLICY "Users can insert their own locations" ON public.locations
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created INSERT policy for locations';
    END IF;
    
    -- Policy for users to update their own locations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Users can update their own locations') THEN
        CREATE POLICY "Users can update their own locations" ON public.locations
            FOR UPDATE USING (auth.uid() = user_id);
        RAISE NOTICE 'Created UPDATE policy for locations';
    END IF;
    
    -- Policy for users to delete their own locations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Users can delete their own locations') THEN
        CREATE POLICY "Users can delete their own locations" ON public.locations
            FOR DELETE USING (auth.uid() = user_id);
        RAISE NOTICE 'Created DELETE policy for locations';
    END IF;
END $$;

-- Check if message_history table has message_type column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message_history' AND column_name = 'message_type') THEN
        ALTER TABLE public.message_history ADD COLUMN message_type TEXT DEFAULT 'text';
        RAISE NOTICE 'Added message_type column to message_history';
    END IF;
END $$;

-- Verify the table structure
SELECT 
    'Locations table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'locations'
ORDER BY ordinal_position;

-- Show RLS policies
SELECT 
    'RLS Policies for locations:' as info,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'locations';

SELECT 'Locations table setup completed successfully!' as status;
