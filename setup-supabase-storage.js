const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSupabaseStorage() {
  try {
    console.log('🚀 Setting up Supabase Storage for WhatsApp sessions...');
    
    // Create a bucket for WhatsApp sessions
    const { data: bucket, error: bucketError } = await supabase.storage
      .createBucket('whatsapp-sessions', {
        public: false,
        allowedMimeTypes: ['application/json', 'text/plain'],
        fileSizeLimit: 10485760 // 10MB limit
      });

    if (bucketError && bucketError.message !== 'Bucket already exists') {
      throw bucketError;
    }

    console.log('✅ WhatsApp sessions bucket created successfully!');
    
    // Create RLS policies for the bucket
    const policies = [
      {
        name: 'Users can upload their own sessions',
        policy: `
          CREATE POLICY "Users can upload their own sessions" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'whatsapp-sessions' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        name: 'Users can view their own sessions',
        policy: `
          CREATE POLICY "Users can view their own sessions" ON storage.objects
          FOR SELECT USING (
            bucket_id = 'whatsapp-sessions' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        name: 'Users can update their own sessions',
        policy: `
          CREATE POLICY "Users can update their own sessions" ON storage.objects
          FOR UPDATE USING (
            bucket_id = 'whatsapp-sessions' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        name: 'Users can delete their own sessions',
        policy: `
          CREATE POLICY "Users can delete their own sessions" ON storage.objects
          FOR DELETE USING (
            bucket_id = 'whatsapp-sessions' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      }
    ];

    for (const policy of policies) {
      try {
        await supabase.rpc('exec_sql', { sql: policy.policy });
        console.log(`✅ Policy created: ${policy.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Policy already exists: ${policy.name}`);
        } else {
          console.error(`❌ Error creating policy ${policy.name}:`, error.message);
        }
      }
    }

    console.log('🎉 Supabase Storage setup complete!');
    console.log('📁 Bucket: whatsapp-sessions');
    console.log('🔒 RLS policies: Configured for user isolation');
    
  } catch (error) {
    console.error('❌ Error setting up Supabase Storage:', error);
  }
}

setupSupabaseStorage();
