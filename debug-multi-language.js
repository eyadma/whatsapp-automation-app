const supabase = require('./config/supabase.js');

// Mock the enhancedMessageAPI functions for testing
const mockEnhancedMessageAPI = {
  getLocalizedAreaName: (areaData, language) => {
    if (!areaData) return 'Unknown Area';
    
    switch (language) {
      case 'ar':
        return areaData.name_arabic || areaData.name_english || 'منطقة غير معروفة';
      case 'he':
        return areaData.name_hebrew || areaData.name_english || 'אזור לא ידוע';
      default:
        return areaData.name_english || areaData.name_arabic || areaData.name_hebrew || 'Unknown Area';
    }
  },

  replacePlaceholders: (template, customer, eta, areaData) => {
    let message = template;
    message = message.replace(/{name}/g, customer.name || '');
    message = message.replace(/{area}/g, customer.area || '');
    message = message.replace(/{package_id}/g, customer.package_id || '');
    message = message.replace(/{package_price}/g, customer.package_price ? `₪${customer.package_price}` : '');
    return message;
  },

  createMultiLanguageMessages: (template, customer, eta = null, areaData = null) => {
    try {
      console.log(`🔍 DEBUG createMultiLanguageMessages called for customer ${customer.name}:`);
      console.log(`   - customer.areaId:`, customer.areaId);
      console.log(`   - areaData:`, areaData);
      console.log(`   - areaData.areaId:`, areaData?.areaId);
      console.log(`   - areaData.preferred_language_1:`, areaData?.preferred_language_1);
      console.log(`   - areaData.preferred_language_2:`, areaData?.preferred_language_2);
      
      // Determine preferred languages from area
      let preferredLanguages = ['en']; // Default to English
      
      if (areaData) {
        preferredLanguages = [];
        if (areaData.preferred_language_1) {
          const lang1 = areaData.preferred_language_1.trim();
          if (lang1) preferredLanguages.push(lang1);
        }
        if (areaData.preferred_language_2) {
          const lang2 = areaData.preferred_language_2.trim();
          if (lang2 && lang2 !== areaData.preferred_language_1?.trim()) {
            preferredLanguages.push(lang2);
          }
        }
        if (preferredLanguages.length === 0) preferredLanguages = ['en'];
      }

      console.log(`🌍 Creating messages for languages:`, preferredLanguages);

      // If only one language, return single message
      if (preferredLanguages.length === 1) {
        const language = preferredLanguages[0];
        console.log(`🔤 Using single language: ${language}`);
        
        // Select the appropriate template for this language
        let languageTemplate = template;
        if (typeof template === 'object' && template.template_arabic) {
          // Template object with multiple language versions
          if (language === 'ar') {
            languageTemplate = template.template_arabic || template.template_english || template.template_hebrew;
          } else if (language === 'he') {
            languageTemplate = template.template_hebrew || template.template_english || template.template_arabic;
          } else {
            languageTemplate = template.template_english || template.template_hebrew || template.template_arabic;
          }
        }
        
        console.log(`📝 Template for ${language}:`, languageTemplate.substring(0, 100) + '...');
        
        const localizedCustomer = {
          ...customer,
          area: mockEnhancedMessageAPI.getLocalizedAreaName(areaData, language)
        };
        const result = mockEnhancedMessageAPI.replacePlaceholders(languageTemplate, localizedCustomer, eta, areaData);
        console.log(`📤 Single language result:`, result.substring(0, 100) + '...');
        return result;
      }

      // Multiple languages - create separate messages
      console.log(`🔤 Creating multiple language messages for:`, preferredLanguages);
      const messages = [];
      for (const language of preferredLanguages) {
        // Select the appropriate template for this language
        let languageTemplate = template;
        if (typeof template === 'object' && template.template_arabic) {
          // Template object with multiple language versions
          if (language === 'ar') {
            languageTemplate = template.template_arabic || template.template_english || template.template_hebrew;
          } else if (language === 'he') {
            languageTemplate = template.template_hebrew || template.template_english || template.template_arabic;
          } else {
            languageTemplate = template.template_english || template.template_hebrew || template.template_arabic;
          }
        }
        
        console.log(`📝 Template for ${language}:`, languageTemplate.substring(0, 100) + '...');
        
        const localizedCustomer = {
          ...customer,
          area: mockEnhancedMessageAPI.getLocalizedAreaName(areaData, language)
        };
        
        console.log(`🔤 Processing ${language} for customer ${customer.name}, localized area: ${localizedCustomer.area}`);
        const message = mockEnhancedMessageAPI.replacePlaceholders(languageTemplate, localizedCustomer, eta, areaData);
        messages.push(message);
        
        console.log(`📝 Created ${language} message for ${customer.name}:`, message.substring(0, 100) + '...');
      }

      console.log(`📤 Returning ${messages.length} messages for ${customer.name}`);
      return messages;
    } catch (error) {
      console.error('Error creating multi-language messages:', error);
      return template;
    }
  }
};

async function debugMultiLanguage() {
  console.log('🔍 Debugging multi-language message creation...\n');
  
  // Get a template
  const { data: templateData, error: templateError } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', 6)
    .single();

  if (templateError) {
    console.error('Error getting template:', templateError);
    return;
  }

  // Test with different areas
  const testCases = [
    {
      areaId: 1301,
      name: 'Latrun',
      expectedLanguages: ['he', 'en'],
      customer: { name: 'John Doe', areaId: 1301, package_id: 'PKG123', package_price: 50 }
    },
    {
      areaId: 1294,
      name: 'Bir al-Mashash',
      expectedLanguages: ['ar'],
      customer: { name: 'Ahmed Ali', areaId: 1294, package_id: 'PKG456', package_price: 75 }
    },
    {
      areaId: 1279,
      name: 'Ramat Hahayal',
      expectedLanguages: ['he', 'en'],
      customer: { name: 'David Cohen', areaId: 1279, package_id: 'PKG789', package_price: 100 }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📍 Testing ${testCase.name} (Area ${testCase.areaId}):`);
    
    // Get area data
    const { data: areaData, error: areaError } = await supabase
      .from('areas')
      .select('*')
      .eq('areaId', testCase.areaId)
      .single();

    if (areaError) {
      console.error(`  ❌ Error getting area:`, areaError.message);
      continue;
    }

    console.log(`  Area preferences: ${areaData.preferred_language_1}, ${areaData.preferred_language_2}`);
    console.log(`  Expected languages: ${testCase.expectedLanguages.join(', ')}`);

    // Test the function
    const result = mockEnhancedMessageAPI.createMultiLanguageMessages(
      templateData,
      testCase.customer,
      null,
      areaData
    );

    console.log(`  Result type: ${Array.isArray(result) ? 'Array' : 'String'}`);
    if (Array.isArray(result)) {
      console.log(`  Number of messages: ${result.length}`);
      result.forEach((msg, index) => {
        console.log(`  Message ${index + 1}: ${msg.substring(0, 50)}...`);
      });
    } else {
      console.log(`  Single message: ${result.substring(0, 50)}...`);
    }
  }
}

debugMultiLanguage();
