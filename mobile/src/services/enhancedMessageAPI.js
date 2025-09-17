import { supabase } from './supabase';
import { areasAPI } from './areasAPI';

export const enhancedMessageAPI = {
  // Get message template with language selection based on area preferences
  getLocalizedMessage: async (template, customer, language = 'en') => {
    try {
      // Helper to normalize any template-like input into a string
      const normalizeTemplate = (tpl) => {
        if (typeof tpl === 'string') return tpl;
        if (tpl && typeof tpl === 'object') {
          if (typeof tpl.template === 'string') return tpl.template;
        }
        return '';
      };

      // Get area information for the customer
      // Use areaId from customers table (integer)
      const areaId = customer.areaId;
      if (!areaId) {
        console.warn('No areaId found for customer:', customer);
        return normalizeTemplate(template);
      }

      const areaResponse = await areasAPI.getById(areaId);
      const area = areaResponse.data.area;
      
      if (!area) {
        console.warn('Area not found for customer:', areaId);
        // Return template with basic customer data replacement
        return enhancedMessageAPI.replacePlaceholders(normalizeTemplate(template), customer, null, null);
      }

      // Determine message language based on area preferences
      const messageLanguage = enhancedMessageAPI.determineMessageLanguage(area, language);
      
      // Replace placeholders with customer data
      const personalizedMessage = enhancedMessageAPI.replacePlaceholders(
        normalizeTemplate(template), 
        customer, 
        null,
        area
      );

      return personalizedMessage;
    } catch (error) {
      console.error('Error getting localized message:', error);
      return typeof template === 'string' ? template : '';
    }
  },

  // Determine message language based on area preferences
  determineMessageLanguage: (area, userLanguage) => {
    if (!area) return userLanguage;
    
    const { preferred_language_1, preferred_language_2 } = area;
    
    // If only one preferred language, use it
    if (preferred_language_1 && !preferred_language_2) {
      return preferred_language_1;
    }
    
    // If two preferred languages, create dual language message
    if (preferred_language_1 && preferred_language_2) {
      return 'dual';
    }
    
    // Fallback to user's language preference
    return userLanguage;
  },

  // Language resources (for default phrases like dual separator)
  getLanguageResources: (language) => {
    const resources = {
      en: {
        welcome: `Hello {name}! Your package {package_id} is ready for delivery.`,
        delivery: `Your package {package_id} worth ₪{package_price} will be delivered to {area}.`,
        return: `IMPORTANT: You have a return item. Please prepare it for pickup.`,
        eta: `Estimated arrival time: {eta}`,
        business: `Business: {business_name}`,
        dual_separator: '\n\n---\n\n'
      },
      he: {
        welcome: `שלום {name}! החבילה שלך {package_id} מוכנה למסירה.`,
        delivery: `החבילה שלך {package_id} בשווי ₪{package_price} תימסר ל{area}.`,
        return: `חשוב: יש לך פריט להחזרה. אנא הכין אותו לאיסוף.`,
        eta: `זמן הגעה משוער: {eta}`,
        business: `עסק: {business_name}`,
        dual_separator: '\n\n---\n\n'
      },
      ar: {
        welcome: `مرحباً {name}! الطرد الخاص بك {package_id} جاهز للتسليم.`,
        delivery: `سيتم تسليم الطرد الخاص بك {package_id} بقيمة ₪{package_price} إلى {area}.`,
        return: `مهم: لديك عنصر للعودة. يرجى تحضيره للاستلام.`,
        eta: `وقت الوصول المتوقع: {eta}`,
        business: `العمل: {business_name}`,
        dual_separator: '\n\n---\n\n'
      }
    };
    return resources[language] || resources.en;
  },

  // Get localized template based on area preferences
  getLocalizedTemplate: async (templateId, areaId, userId) => {
    try {
      // Get template
      const { data: templateData, error: templateError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Get area preferences - areas table uses 'areaId' (camelCase)
      const { data: areaData, error: areaError } = await supabase
        .from('areas')
        .select('preferred_language_1, preferred_language_2')
        .eq('areaId', areaId)
        .single();

      if (areaError) throw areaError;

      const template = templateData;
      const area = areaData;

      console.log(`Template ${templateId} for area ${areaId}:`, {
        areaPreferences: area,
        templateLanguages: {
          arabic: !!template.template_arabic,
          hebrew: !!template.template_hebrew,
          english: !!template.template_english
        }
      });

      // Determine language based on area preferences
      let primaryLanguage = 'en'; // Default to English instead of Arabic
      let secondaryLanguage = null;

      if (area.preferred_language_1) {
        primaryLanguage = area.preferred_language_1;
      }

      if (area.preferred_language_2) {
        secondaryLanguage = area.preferred_language_2;
      }

      // Get template text based on language
      let templateText = '';
      if (primaryLanguage === 'ar') {
        templateText = template.template_arabic;
      } else if (primaryLanguage === 'he') {
        templateText = template.template_hebrew;
      } else if (primaryLanguage === 'en') {
        templateText = template.template_english;
      }

      // If no template text found for primary language, fallback to available languages
      if (!templateText) {
        if (template.template_arabic) {
          templateText = template.template_arabic;
          primaryLanguage = 'ar';
        } else if (template.template_hebrew) {
          templateText = template.template_hebrew;
          primaryLanguage = 'he';
        } else if (template.template_english) {
          templateText = template.template_english;
          primaryLanguage = 'en';
        }
      }

      // If dual language is preferred, combine templates
      if (secondaryLanguage) {
        let secondaryText = '';
        if (secondaryLanguage === 'ar') {
          secondaryText = template.template_arabic;
        } else if (secondaryLanguage === 'he') {
          secondaryText = template.template_hebrew;
        } else if (secondaryLanguage === 'en') {
          secondaryText = template.template_english;
        }

        // Only combine if secondary text exists and is different from primary
        if (secondaryText && secondaryText !== templateText) {
          // Combine with separator based on language pair
          if ((primaryLanguage === 'ar' && secondaryLanguage === 'he') || 
              (primaryLanguage === 'he' && secondaryLanguage === 'ar')) {
            templateText = `${templateText}\n\n${secondaryText}`;
          } else {
            templateText = `${templateText}\n\n${secondaryText}`;
          }
        }
      }

      console.log(`Selected language: ${primaryLanguage}, Template length: ${templateText?.length || 0}`);

      return { data: { template: templateText, primaryLanguage, secondaryLanguage } };
    } catch (error) {
      console.error('Error getting localized template:', error);
      throw error;
    }
  },

  // Replace placeholders in template with customer data
  replacePlaceholders: (template, customer, eta = null, areaData = null) => {
    try {
      let message = template;

      // Replace basic placeholders
      message = message.replace(/{name}/g, customer.name || '');
      message = message.replace(/{phone}/g, customer.phone || '');
      message = message.replace(/{phone2}/g, customer.phone2 || '');
      message = message.replace(/{area}/g, customer.area || '');
      message = message.replace(/{package_price}/g, customer.package_price ? `₪${customer.package_price}` : '');
      message = message.replace(/{package_id}/g, customer.package_id || '');
      message = message.replace(/{business_name}/g, customer.business_name || '');
      
      // Replace language-specific area placeholders
      if (areaData && customer.areaId) {
        // Use the area data passed to the function
        const areaNames = {
          english: areaData.name_english || '',
          hebrew: areaData.name_hebrew || '',
          arabic: areaData.name_arabic || ''
        };
        
        // Replace language-specific area placeholders
        message = message.replace(/{area_he}/g, areaNames.hebrew || customer.area || '');
        message = message.replace(/{area_en}/g, areaNames.english || customer.area || '');
        message = message.replace(/{area_ar}/g, areaNames.arabic || customer.area || '');
        
        console.log(`🌍 Area placeholders replaced for customer ${customer.name}:`, {
          areaId: customer.areaId,
          hebrew: areaNames.hebrew,
          english: areaNames.english,
          arabic: areaNames.arabic,
          original: customer.area
        });
      }

      // Replace ETA placeholder - handle both string and object ETA
      if (eta) {
        let etaString = eta;
        if (typeof eta === 'object') {
          etaString = eta.eta || eta.toString() || '';
        } else if (typeof eta === 'string') {
          etaString = eta;
        } else {
          etaString = String(eta);
        }
        message = message.replace(/{eta}/g, etaString);
      }

      // Add return message if customer has return items
      if (customer.has_return) {
        const returnMessages = {
          ar: '\n\nملاحظة: هذا الطرد يحتوي على عناصر قابلة للإرجاع. يرجى الاحتفاظ بها.',
          he: '\n\nהערה: החבילה הזו מכילה פריטים להחזרה. אנא שמור עליהם.',
          en: '\n\nNote: This package contains returnable items. Please keep them safe.'
        };

        // Determine customer's preferred languages
        let preferredLanguages = ['en']; // Default to English
        
        // Check if customer has preferred languages
        if (customer.preferred_language) {
          preferredLanguages = [customer.preferred_language];
        } else if (customer.language) {
          preferredLanguages = [customer.language];
        } else if (areaData) {
          // Use area's preferred languages as fallback
          preferredLanguages = [];
          if (areaData.preferred_language_1) preferredLanguages.push(areaData.preferred_language_1);
          if (areaData.preferred_language_2 && areaData.preferred_language_2 !== areaData.preferred_language_1) {
            preferredLanguages.push(areaData.preferred_language_2);
          }
          if (preferredLanguages.length === 0) preferredLanguages = ['en'];
        }

        // Add return message in all preferred languages
        if (preferredLanguages.length === 1) {
          // Single language - add return message in that language
          const language = preferredLanguages[0];
          if (returnMessages[language]) {
            message += returnMessages[language];
          } else {
            message += returnMessages.en; // Fallback to English
          }
        } else if (preferredLanguages.length > 1) {
          // Multiple languages - add return message in both languages
          const returnMessage1 = returnMessages[preferredLanguages[0]] || returnMessages.en;
          const returnMessage2 = returnMessages[preferredLanguages[1]] || returnMessages.en;
          
          // Only add second language if it's different from the first
          if (returnMessage1 !== returnMessage2) {
            message += returnMessage1 + '\n\n' + returnMessage2;
          } else {
            message += returnMessage1;
          }
        } else {
          // Fallback to English
          message += returnMessages.en;
        }
      }

      return message;
    } catch (error) {
      console.error('Error replacing placeholders:', error);
      return template;
    }
  },

  // Create dual language message
  createDualLanguageMessage: async (template, customer, area) => {
    try {
      if (!area) {
        // Fallback to single language if no area data
        return await enhancedMessageAPI.getLocalizedMessage(template, customer, 'en');
      }
      
      const { preferred_language_1, preferred_language_2 } = area;
      
      // Get messages in both languages with proper return message handling
      const message1 = await enhancedMessageAPI.getLocalizedMessage(template, customer, preferred_language_1);
      const message2 = await enhancedMessageAPI.getLocalizedMessage(template, customer, preferred_language_2);
      
      const separator = enhancedMessageAPI.getLanguageResources(preferred_language_1).dual_separator;
      
      // For dual language messages, we need to handle return messages differently
      // to avoid duplication since both messages will have return messages added
      let finalMessage = message1 + separator + message2;
      
      // If customer has return items, we need to remove duplicate return messages
      // and add them properly for dual language
      if (customer.has_return) {
        const returnMessages = {
          ar: '\n\nملاحظة: هذا الطرد يحتوي على عناصر قابلة للتبديل . يرجى  تحضيرها.',
          he: '\n\nהערה: החבילה הזו מכילה פריטים להחלפה .  נא להכין את המוצרים שצריך להחליף  .',
          en: '\n\nNote: This package contains returnable items. Please  prepare old items for replacement.'
        };

        
        // Remove any existing return messages from both parts
        const returnMessagePatterns = [
          returnMessages.ar,
          returnMessages.he,
          returnMessages.en
        ];
        
        let cleanMessage1 = message1;
        let cleanMessage2 = message2;
        
        returnMessagePatterns.forEach(pattern => {
          cleanMessage1 = cleanMessage1.replace(pattern, '');
          cleanMessage2 = cleanMessage2.replace(pattern, '');
        });
        
        // Add return messages in both languages
        const returnMessage1 = returnMessages[preferred_language_1] || returnMessages.en;
        const returnMessage2 = returnMessages[preferred_language_2] || returnMessages.en;
        
        if (returnMessage1 !== returnMessage2) {
          finalMessage = cleanMessage1 + returnMessage1 + separator + cleanMessage2 + returnMessage2;
        } else {
          finalMessage = cleanMessage1 + separator + cleanMessage2 + returnMessage1;
        }
      }
      
      return finalMessage;
    } catch (error) {
      console.error('Error creating dual language message:', error);
      return (typeof template === 'string') ? template : '';
    }
  },

  // Get area names for different languages (synchronous version for placeholder replacement)
  getAreaNamesForLanguages: (areaId) => {
    // This function needs to be synchronous for placeholder replacement
    // We'll use a cached approach or get the data from the areas already loaded
    try {
      // For now, return empty names - this will be enhanced in the next step
      // when we pass area data directly to replacePlaceholders
      return { english: '', hebrew: '', arabic: '' };
    } catch (error) {
      console.error('Error getting area names for languages:', error);
      return { english: '', hebrew: '', arabic: '' };
    }
  },

  // Get ETA for specific area and user
  getAreaETA: async (areaId, userId) => {
    try {
      const { data, error } = await supabase
        .from('area_etas')
        .select('eta')
        .eq('areaid', areaId) // area_etas uses areaid (lowercase)
        .eq('userid', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No ETA found, return null
          return null;
        }
        throw error;
      }
      return data?.eta || null;
    } catch (error) {
      console.error('Error getting area ETA:', error);
      return null;
    }
  },

  // Set ETA for specific area and user
  setAreaETA: async (areaId, eta, userId) => {
    try {
      const { data, error } = await supabase
        .from('area_etas')
        .upsert({ 
          areaid: areaId, // area_etas uses areaid (lowercase)
          eta, 
          userid: userId 
        }, {
          onConflict: 'userid,areaid'
        })
        .select()
        .single();

      if (error) throw error;
      return { data: { eta: data } };
    } catch (error) {
      console.error('Error setting area ETA:', error);
      throw error;
    }
  },

  // Get all ETAs for user's customer areas
  getUserAreaETAs: async (userId) => {
    try {
      // Get all customers for the user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('areaId') // customers uses areaId (camelCase)
        .eq('user_id', userId); // Use user_id column name

      if (customersError) throw customersError;

      // Get unique area IDs
      const areaIds = [...new Set(customers.map(c => c.areaId).filter(id => id != null))];

      if (areaIds.length === 0) {
        return { data: { etas: [] } };
      }

      // Get ETAs for these areas for this specific user
      const { data: etas, error: etasError } = await supabase
        .from('area_etas')
        .select('areaid, eta')
        .eq('userid', userId)
        .in('areaid', areaIds);

      if (etasError) throw etasError;

      return { data: { etas: etas || [] } };
    } catch (error) {
      console.error('Error getting user area ETAs:', error);
      throw error;
    }
  },

  // Get user's areas with ETAs
  getUserAreasWithETAs: async (userId) => {
    try {
      // Get all customers for the user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('areaId') // customers uses areaId (camelCase)
        .eq('user_id', userId)
        .not('areaId', 'is', null);

      if (customersError) throw customersError;

      const areaIds = [...new Set(customers.map(c => c.areaId).filter(id => id != null))];

      if (areaIds.length === 0) {
        return { data: { areas: [] } };
      }

      // Get areas with ETAs
      const { data: areasWithETAs, error: areasError } = await supabase
        .from('area_etas')
        .select('areaid, eta')
        .eq('userid', userId)
        .in('areaid', areaIds);

      if (areasError) throw areasError;

      // Get area details
      const { data: areaDetails, error: areaDetailsError } = await supabase
        .from('areas')
        .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
        .in('areaId', areaIds);

      if (areaDetailsError) throw areaDetailsError;

      // Combine area details with ETAs
      const areas = areaDetails.map(area => {
        const eta = areasWithETAs.find(e => e.areaid === area.areaId);
        const result = {
          ...area,
          eta: eta ? eta.eta : null
        };
        
        console.log(`🔍 DEBUG getUserAreasWithETAs - Area ${area.areaId}:`, {
          name_english: area.name_english,
          name_hebrew: area.name_hebrew,
          name_arabic: area.name_arabic,
          preferred_language_1: area.preferred_language_1,
          preferred_language_2: area.preferred_language_2
        });
        
        return result;
      });

      console.log(`📊 Total areas loaded: ${areas.length}`);
      return { data: { areas } };
    } catch (error) {
      console.error('Error getting user areas with ETAs:', error);
      return { data: { areas: [] } };
    }
  },

  // Generate complete personalized message
  generatePersonalizedMessage: async (template, customer, userId) => {
    try {
      // Get area information
      const areaId = customer.areaId;
      if (!areaId) {
        console.warn('No areaId found for customer:', customer);
        // Return template with basic customer data replacement
        return enhancedMessageAPI.replacePlaceholders(template, customer, null, null);
      }

      const areaResponse = await areasAPI.getById(areaId);
      const area = areaResponse.data.area;
      
      if (!area) {
        console.warn('Area not found for customer:', areaId);
        // Return template with basic customer data replacement
        return enhancedMessageAPI.replacePlaceholders(template, customer, null, null);
      }

      // Get ETA for the area for this specific user
      const eta = await enhancedMessageAPI.getAreaETA(areaId, userId);
      
      // Add ETA to customer data if available (ensure it's a string)
      const customerWithETA = { 
        ...customer, 
        eta: eta ? String(eta) : null 
      };
      
      // Determine message language
      const messageLanguage = enhancedMessageAPI.determineMessageLanguage(area, 'en');
      
      let finalMessage;
      
      if (messageLanguage === 'dual') {
        // Create dual language message
        finalMessage = await enhancedMessageAPI.createDualLanguageMessage(template, customerWithETA, area);
      } else {
        // Create single language message
        finalMessage = await enhancedMessageAPI.getLocalizedMessage(template, customerWithETA, messageLanguage);
      }
      
      return finalMessage;
    } catch (error) {
      console.error('Error generating personalized message:', error);
      return template;
    }
  },

  // Delete ETA for specific area and user
  deleteAreaETA: async (areaId, userId) => {
    try {
      const { error } = await supabase
        .from('area_etas')
        .delete()
        .eq('areaid', areaId)
        .eq('userid', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting area ETA:', error);
      throw error;
    }
  },

  // Get ETA statistics for user
  getUserETAStats: async (userId) => {
    try {
      // Get total areas for user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('areaId')
        .eq('user_id', userId);

      if (customersError) throw customersError;

      const totalAreas = [...new Set(customers.map(c => c.areaId).filter(id => id != null))].length;

      // Get areas with ETAs
      const { data: etas, error: etasError } = await supabase
        .from('area_etas')
        .select('areaid')
        .eq('userid', userId);

      if (etasError) throw etasError;

      const areasWithETAs = etas.length;

      return {
        data: {
          totalAreas,
          areasWithETAs,
          areasWithoutETAs: totalAreas - areasWithETAs,
          completionPercentage: totalAreas > 0 ? Math.round((areasWithETAs / totalAreas) * 100) : 0
        }
      };
    } catch (error) {
      console.error('Error getting ETA stats:', error);
      return { data: { totalAreas: 0, areasWithETAs: 0, areasWithoutETAs: 0, completionPercentage: 0 } };
    }
  },

  // Initialize areas table if empty
  initializeAreasIfNeeded: async () => {
    try {
      const result = await areasAPI.initializeDefaultAreas();
      if (result.data.initialized) {
        console.log('Areas table initialized with default data');
      }
      return result;
    } catch (error) {
      console.error('Error initializing areas:', error);
      throw error;
    }
  },

  // Get areas for user (areas that have customers assigned to the user)
  getAreasForUser: async (userId) => {
    try {
      // Get all customers for the user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('areaId') // customers uses areaId
        .eq('user_id', userId)
        .not('areaId', 'is', null);

      if (customersError) throw customersError;

      const areaIds2 = [...new Set(customers.map(c => c.areaId).filter(id => id != null))];

      if (areaIds2.length === 0) {
        return { data: { areas: [] } };
      }

      // Get area details
      const { data: areas, error: areasError } = await supabase
        .from('areas')
        .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
        .in('areaId', areaIds2);

      if (areasError) throw areasError;

      return { data: { areas } };
    } catch (error) {
      console.error('Error getting areas for user:', error);
      return { data: { areas: [] } };
    }
  },

  // Get message with ETA for a specific customer
  getMessageWithETA: async (template, customer, userId) => {
    try {
      // Helper to normalize any template-like input into a string
      const normalizeTemplate = (tpl) => {
        if (typeof tpl === 'string') return tpl;
        if (tpl && typeof tpl === 'object') {
          if (typeof tpl.template === 'string') return tpl.template;
        }
        return '';
      };

      // Get area information for the customer
      const areaId = customer.areaid;
      if (!areaId) {
        console.warn('No areaId found for customer:', customer);
        return normalizeTemplate(template);
      }

      const areaResponse = await areasAPI.getById(areaId);
      const area = areaResponse.data.area;
      
      if (!area) {
        console.warn('Area not found for customer:', areaId);
        return enhancedMessageAPI.replacePlaceholders(normalizeTemplate(template), customer, null, null);
      }

      // Get ETA for this area and user
      const eta = await enhancedMessageAPI.getAreaETA(areaId, userId);
      
      // Replace placeholders with customer data and ETA
      const personalizedMessage = enhancedMessageAPI.replacePlaceholders(
        normalizeTemplate(template), 
        customer, 
        eta,
        area
      );

      return personalizedMessage;
    } catch (error) {
      console.error('Error getting message with ETA:', error);
      return typeof template === 'string' ? template : '';
    }
  },

  // Get total number of areas for user
  getTotalAreasForUser: async (userId) => {
    try {
      // Get all customers for the user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('areaId')
        .eq('user_id', userId)
        .not('areaId', 'is', null);

      if (customersError) throw customersError;

      const totalAreas = [...new Set(customers.map(c => c.areaId).filter(id => id != null))].length;

      return { data: { totalAreas } };
    } catch (error) {
      console.error('Error getting total areas for user:', error);
      return { data: { totalAreas: 0 } };
    }
  },

  // Create multiple language messages based on area preferences
  createMultiLanguageMessages: (template, customer, eta = null, areaData = null) => {
    try {
      console.log(`🔍 DEBUG createMultiLanguageMessages called for customer ${customer.name}:`);
      console.log(`   - customer.areaId:`, customer.areaId);
      console.log(`   - areaData:`, areaData);
      console.log(`   - areaData.areaId:`, areaData?.areaId);
      console.log(`   - areaData.preferred_language_1:`, areaData?.preferred_language_1);
      console.log(`   - areaData.preferred_language_2:`, areaData?.preferred_language_2);
      console.log(`   - areaData.name_english:`, areaData?.name_english);
      console.log(`   - areaData.name_hebrew:`, areaData?.name_hebrew);
      console.log(`   - areaData.name_arabic:`, areaData?.name_arabic);
      
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
            languageTemplate = template.template_arabic || template.template_hebrew || template.template_english;
          } else if (language === 'he') {
            languageTemplate = template.template_hebrew || template.template_arabic || template.template_english;
          } else {
            languageTemplate = template.template_english || template.template_arabic || template.template_hebrew;
          }
        }
        
        console.log(`📝 Template for ${language}:`, languageTemplate.substring(0, 100) + '...');
        
        const localizedCustomer = {
          ...customer,
          area: enhancedMessageAPI.getLocalizedAreaName(areaData, language)
        };
        const result = enhancedMessageAPI.replacePlaceholders(languageTemplate, localizedCustomer, eta, areaData);
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
            languageTemplate = template.template_arabic || template.template_hebrew || template.template_english;
          } else if (language === 'he') {
            languageTemplate = template.template_hebrew || template.template_arabic || template.template_english;
          } else {
            languageTemplate = template.template_english || template.template_arabic || template.template_hebrew;
          }
        }
        
        console.log(`📝 Template for ${language}:`, languageTemplate.substring(0, 100) + '...');
        
        const localizedCustomer = {
          ...customer,
          area: enhancedMessageAPI.getLocalizedAreaName(areaData, language)
        };
        
        console.log(`🔤 Processing ${language} for customer ${customer.name}, localized area: ${localizedCustomer.area}`);
        const message = enhancedMessageAPI.replacePlaceholders(languageTemplate, localizedCustomer, eta, areaData);
        messages.push(message);
        
        console.log(`📝 Created ${language} message for ${customer.name}:`, message.substring(0, 100) + '...');
      }

      console.log(`📤 Returning ${messages.length} messages for ${customer.name}`);
      return messages;
    } catch (error) {
      console.error('Error creating multi-language messages:', error);
      return template;
    }
  },

  // Get localized area name for specific language
  getLocalizedAreaName: (areaData, language) => {
    if (!areaData) return 'Unknown Area';
    
    switch (language) {
      case 'he':
        return areaData.name_hebrew || areaData.name_english || 'Unknown Area';
      case 'ar':
        return areaData.name_arabic || areaData.name_english || 'Unknown Area';
      case 'en':
      default:
        return areaData.name_english || 'Unknown Area';
    }
  }
}; 