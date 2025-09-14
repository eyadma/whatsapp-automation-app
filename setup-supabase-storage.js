const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageBucket() {
  try {
    console.log('🚀 Setting up Supabase storage bucket for WhatsApp sessions...');
    
    // Create the storage bucket
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('whatsapp-sessions', {
      public: false,
      allowedMimeTypes: ['application/json', 'text/plain'],
      fileSizeLimit: 10485760, // 10MB limit
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Storage bucket "whatsapp-sessions" already exists');
      } else {
        throw bucketError;
      }
    } else {
      console.log('✅ Storage bucket "whatsapp-sessions" created successfully');
    }

    // Set up RLS policies for the bucket
    console.log('🔒 Setting up RLS policies for storage bucket...');
    
    // Policy to allow authenticated users to upload their own session files
    const { error: uploadPolicyError } = await supabase.rpc('create_storage_policy', {
      bucket_name: 'whatsapp-sessions',
      policy_name: 'Users can upload their own session files',
      policy_definition: `
        (bucket_id = 'whatsapp-sessions'::text) AND 
        (auth.uid()::text = (storage.foldername(name))[1])
      `,
      policy_check: null,
      policy_with_check: null
    });

    if (uploadPolicyError && !uploadPolicyError.message.includes('already exists')) {
      console.warn('⚠️ Could not create upload policy:', uploadPolicyError.message);
    } else {
      console.log('✅ Upload policy created');
    }

    // Policy to allow users to read their own session files
    const { error: readPolicyError } = await supabase.rpc('create_storage_policy', {
      bucket_name: 'whatsapp-sessions',
      policy_name: 'Users can read their own session files',
      policy_definition: `
        (bucket_id = 'whatsapp-sessions'::text) AND 
        (auth.uid()::text = (storage.foldername(name))[1])
      `,
      policy_check: null,
      policy_with_check: null
    });

    if (readPolicyError && !readPolicyError.message.includes('already exists')) {
      console.warn('⚠️ Could not create read policy:', readPolicyError.message);
    } else {
      console.log('✅ Read policy created');
    }

    // Policy to allow users to delete their own session files
    const { error: deletePolicyError } = await supabase.rpc('create_storage_policy', {
      bucket_name: 'whatsapp-sessions',
      policy_name: 'Users can delete their own session files',
      policy_definition: `
        (bucket_id = 'whatsapp-sessions'::text) AND 
        (auth.uid()::text = (storage.foldername(name))[1])
      `,
      policy_check: null,
      policy_with_check: null
    });

    if (deletePolicyError && !deletePolicyError.message.includes('already exists')) {
      console.warn('⚠️ Could not create delete policy:', deletePolicyError.message);
    } else {
      console.log('✅ Delete policy created');
    }

    console.log('🎉 Supabase storage setup completed successfully!');
    console.log('📁 Bucket name: whatsapp-sessions');
    console.log('🔒 Access: Private with user-based RLS policies');
    
  } catch (error) {
    console.error('❌ Error setting up Supabase storage:', error);
    process.exit(1);
  }
}

// Run the setup
setupStorageBucket();
