const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAreasTable() {
  try {
    console.log('🚀 Creating areas table...');
    
    // Read the SQL file
    const fs = require('fs');
    const sql = fs.readFileSync('./create-areas-table.sql', 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error creating areas table:', error);
      return;
    }
    
    console.log('✅ Areas table created successfully!');
    
    // Verify the table was created
    const { data: areas, error: selectError } = await supabase
      .from('areas')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('❌ Error verifying table:', selectError);
      return;
    }
    
    console.log('📊 Sample areas data:');
    areas.forEach(area => {
      console.log(`- ${area.name_english} (${area.name_arabic} / ${area.name_hebrew})`);
    });
    
    console.log('\n🎉 Areas table setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Alternative method using direct SQL execution
async function createAreasTableAlternative() {
  try {
    console.log('🚀 Creating areas table (alternative method)...');
    
    // Create table
    const { error: createError } = await supabase
      .from('areas')
      .select('*')
      .limit(1);
    
    if (createError && createError.code === '42P01') {
      // Table doesn't exist, create it
      console.log('📋 Table does not exist, creating...');
      
      // You'll need to run the SQL manually in Supabase SQL Editor
      console.log('⚠️  Please run the SQL from create-areas-table.sql in your Supabase SQL Editor');
      console.log('📝 Go to: https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql');
      console.log('📋 Copy and paste the contents of create-areas-table.sql');
      
      return;
    }
    
    console.log('✅ Areas table already exists!');
    
    // Insert sample data
    const sampleAreas = [
      {
        name_arabic: 'القدس',
        name_english: 'Jerusalem',
        name_hebrew: 'ירושלים',
        preferred_language_1: 'ar',
        preferred_language_2: 'en'
      },
      {
        name_arabic: 'تل أبيب',
        name_english: 'Tel Aviv',
        name_hebrew: 'תל אביב',
        preferred_language_1: 'he',
        preferred_language_2: 'en'
      },
      {
        name_arabic: 'حيفا',
        name_english: 'Haifa',
        name_hebrew: 'חיפה',
        preferred_language_1: 'he',
        preferred_language_2: 'ar'
      },
      {
        name_arabic: 'بئر السبع',
        name_english: 'Beer Sheva',
        name_hebrew: 'באר שבע',
        preferred_language_1: 'he',
        preferred_language_2: 'ar'
      },
      {
        name_arabic: 'الناصرة',
        name_english: 'Nazareth',
        name_hebrew: 'נצרת',
        preferred_language_1: 'ar',
        preferred_language_2: 'he'
      }
    ];
    
    const { data, error: insertError } = await supabase
      .from('areas')
      .insert(sampleAreas)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting sample data:', insertError);
      return;
    }
    
    console.log('✅ Sample areas data inserted successfully!');
    console.log('📊 Inserted areas:');
    data.forEach(area => {
      console.log(`- ${area.name_english} (${area.name_arabic} / ${area.name_hebrew})`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the setup
createAreasTableAlternative(); 