const supabase = require('./config/supabase.js');

async function testMessageUsageTracking() {
  console.log('🔍 Testing message usage tracking...\n');
  
  // Test with a sample user ID
  const testUserId = '96b5812c-f639-4340-adf2-cd53b9b789bb';
  
  try {
    // Get initial state
    console.log('📊 Initial state:');
    const { data: initialProfile, error: initialError } = await supabase
      .from('profiles')
      .select('last_message_sent_during_window, daily_usage_tracked, time_restriction_enabled')
      .eq('id', testUserId)
      .single();
    
    if (initialError) {
      console.error('Error getting initial profile:', initialError);
      return;
    }
    
    console.log('  last_message_sent_during_window:', initialProfile.last_message_sent_during_window);
    console.log('  daily_usage_tracked:', initialProfile.daily_usage_tracked);
    console.log('  time_restriction_enabled:', initialProfile.time_restriction_enabled);
    
    // Test the track_message_usage function
    console.log('\n🔄 Calling track_message_usage...');
    const { data: trackResult, error: trackError } = await supabase
      .rpc('track_message_usage', { user_id: testUserId });
    
    if (trackError) {
      console.error('Error tracking message usage:', trackError);
      return;
    }
    
    console.log('✅ track_message_usage result:', trackResult);
    
    // Get updated state
    console.log('\n📊 Updated state:');
    const { data: updatedProfile, error: updatedError } = await supabase
      .from('profiles')
      .select('last_message_sent_during_window, daily_usage_tracked, time_restriction_enabled')
      .eq('id', testUserId)
      .single();
    
    if (updatedError) {
      console.error('Error getting updated profile:', updatedError);
      return;
    }
    
    console.log('  last_message_sent_during_window:', updatedProfile.last_message_sent_during_window);
    console.log('  daily_usage_tracked:', updatedProfile.daily_usage_tracked);
    console.log('  time_restriction_enabled:', updatedProfile.time_restriction_enabled);
    
    // Check if values changed
    const lastMessageChanged = initialProfile.last_message_sent_during_window !== updatedProfile.last_message_sent_during_window;
    const dailyUsageChanged = initialProfile.daily_usage_tracked !== updatedProfile.daily_usage_tracked;
    
    console.log('\n📈 Changes detected:');
    console.log('  last_message_sent_during_window changed:', lastMessageChanged);
    console.log('  daily_usage_tracked changed:', dailyUsageChanged);
    
    if (lastMessageChanged || dailyUsageChanged) {
      console.log('✅ Message usage tracking is working correctly!');
    } else {
      console.log('⚠️ No changes detected - this might be expected if the user already has today\'s usage tracked');
    }
    
    // Test the can_send_messages function
    console.log('\n🔍 Testing can_send_messages function:');
    const { data: canSend, error: canSendError } = await supabase
      .rpc('can_send_messages', { user_id: testUserId });
    
    if (canSendError) {
      console.error('Error checking can_send_messages:', canSendError);
      return;
    }
    
    console.log('  can_send_messages result:', canSend);
    
    // Test the has_used_messaging_today function
    console.log('\n🔍 Testing has_used_messaging_today function:');
    const { data: hasUsed, error: hasUsedError } = await supabase
      .rpc('has_used_messaging_today', { user_id: testUserId });
    
    if (hasUsedError) {
      console.error('Error checking has_used_messaging_today:', hasUsedError);
      return;
    }
    
    console.log('  has_used_messaging_today result:', hasUsed);
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testMessageUsageTracking();
