#!/usr/bin/env node

const supabase = require('./config/supabase');

console.log('🚀 Supabase Setup Script');
console.log('========================\n');

// Check if environment variables are set
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

console.log('✅ Supabase credentials found');
console.log(`🔗 Project URL: ${supabaseUrl}\n`);

async function checkSupabaseSetup() {
  try {
    // Test connection
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase.from('customers').select('count').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!\n');

    // Check for required tables
    console.log('🔍 Checking database tables...');
    
    const tables = ['customers', 'whatsapp_sessions', 'message_templates', 'message_history', 'profiles'];
    const tableStatus = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          tableStatus[table] = false;
        } else {
          tableStatus[table] = true;
        }
      } catch (err) {
        tableStatus[table] = false;
      }
    }

    // Display table status
    for (const [table, exists] of Object.entries(tableStatus)) {
      if (exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' is missing`);
      }
    }

    // Check if profiles table is missing
    if (!tableStatus.profiles) {
      console.log('\n🚨 CRITICAL: Profiles table is missing!');
      console.log('This is required for authentication to work.');
      console.log('\n📋 To fix this:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Click SQL Editor → New Query');
      console.log('3. Copy and paste this SQL:');
      console.log('\n' + '='.repeat(60));
      console.log(`
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'regular' CHECK (role IN ('admin', 'regular')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in TIMESTAMP WITH TIME ZONE,
  customer_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'regular')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
`);
      console.log('='.repeat(60));
      console.log('\n4. Click Run button');
      console.log('5. Wait for success message');
      console.log('6. Run this script again to verify');
      return false;
    }

    console.log('\n🎉 Supabase setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Update your mobile app with Supabase credentials');
    console.log('3. Test the API endpoints');
    console.log('4. Deploy your app!');
    
    return true;

  } catch (error) {
    console.error('❌ Error checking Supabase setup:', error.message);
    return false;
  }
}

checkSupabaseSetup(); 