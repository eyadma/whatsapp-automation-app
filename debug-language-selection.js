const supabase = require('./config/supabase.js');

async function debugLanguageSelection() {
  console.log('🔍 Debugging language selection...\n');
  
  // Test with different areas
  const testAreas = [
    { areaId: 1301, name: 'Latrun', expected: 'he' },
    { areaId: 1294, name: 'Bir al-Mashash', expected: 'ar' },
    { areaId: 1279, name: 'Ramat Hahayal', expected: 'he' }
  ];
  
  const templateId = 6; // Use template 6 for testing
  
  for (const testArea of testAreas) {
    console.log(`\n📍 Testing Area ${testArea.areaId} (${testArea.name}):`);
    
    try {
      // Get template
      const { data: templateData, error: templateError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Get area preferences
      const { data: areaData, error: areaError } = await supabase
        .from('areas')
        .select('preferred_language_1, preferred_language_2')
        .eq('areaId', testArea.areaId)
        .single();

      if (areaError) throw areaError;

      console.log(`  Area preferences: ${areaData.preferred_language_1}, ${areaData.preferred_language_2}`);
      
      // Determine language based on area preferences
      let primaryLanguage = 'en'; // Default to English instead of Arabic
      let secondaryLanguage = null;

      if (areaData.preferred_language_1) {
        primaryLanguage = areaData.preferred_language_1;
      }

      if (areaData.preferred_language_2) {
        secondaryLanguage = areaData.preferred_language_2;
      }

      console.log(`  Selected primary language: ${primaryLanguage}`);
      console.log(`  Selected secondary language: ${secondaryLanguage}`);

      // Get template text based on language
      let templateText = '';
      if (primaryLanguage === 'ar') {
        templateText = templateData.template_arabic;
        console.log(`  Using Arabic template: ${templateText ? 'YES' : 'NO'}`);
      } else if (primaryLanguage === 'he') {
        templateText = templateData.template_hebrew;
        console.log(`  Using Hebrew template: ${templateText ? 'YES' : 'NO'}`);
      } else if (primaryLanguage === 'en') {
        templateText = templateData.template_english;
        console.log(`  Using English template: ${templateText ? 'YES' : 'NO'}`);
      }

      // If no template text found for primary language, fallback to available languages
      if (!templateText) {
        console.log(`  ⚠️ No template found for ${primaryLanguage}, falling back...`);
        if (templateData.template_arabic) {
          templateText = templateData.template_arabic;
          primaryLanguage = 'ar';
          console.log(`  Fallback to Arabic: YES`);
        } else if (templateData.template_hebrew) {
          templateText = templateData.template_hebrew;
          primaryLanguage = 'he';
          console.log(`  Fallback to Hebrew: YES`);
        } else if (templateData.template_english) {
          templateText = templateData.template_english;
          primaryLanguage = 'en';
          console.log(`  Fallback to English: YES`);
        }
      }

      console.log(`  Final language: ${primaryLanguage}`);
      console.log(`  Template length: ${templateText?.length || 0}`);
      console.log(`  Expected: ${testArea.expected}`);
      console.log(`  ✅ Correct: ${primaryLanguage === testArea.expected ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
  }
}

debugLanguageSelection();
