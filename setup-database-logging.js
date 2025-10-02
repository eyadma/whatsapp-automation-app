const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
);

async function setupDatabaseLogging() {
  try {
    console.log('🚀 Setting up database logging...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-logs-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL content loaded, executing...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error executing SQL:', error);
      return false;
    }
    
    console.log('✅ Database logging setup completed successfully!');
    console.log('📊 Logs table created with:');
    console.log('   - Comprehensive indexing for performance');
    console.log('   - Row Level Security (RLS) policies');
    console.log('   - Log retention functions');
    console.log('   - Log statistics functions');
    console.log('   - Recent logs view');
    
    return true;
  } catch (error) {
    console.error('❌ Exception during setup:', error);
    return false;
  }
}

// Run the setup
if (require.main === module) {
  setupDatabaseLogging()
    .then(success => {
      if (success) {
        console.log('🎉 Database logging is ready to use!');
        process.exit(0);
      } else {
        console.log('💥 Setup failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabaseLogging };
