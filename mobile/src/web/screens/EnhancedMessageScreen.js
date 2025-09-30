import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card, TextInput, Divider, List, Chip, useTheme } from 'react-native-paper';
import WebCompatibleButton from '../components/WebCompatibleButton';
import { Ionicons } from '@expo/vector-icons';
import { Portal, Modal } from 'react-native-paper';
// DateTimePicker not compatible with web - using TextInput instead
// import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../../context/AppContext';
import { customersAPI, messageTemplatesAPI, whatsappAPI } from '../../services/api';
import { areasAPI } from '../../services/areasAPI';
import { enhancedMessageAPI } from '../../services/enhancedMessageAPI';
import { messagesAPI } from '../../services/api';
import { timeRestrictionsAPI } from '../../services/timeRestrictionsAPI';
import { supabase } from '../../services/supabase';
import { formatTimeWithArabicNumerals, formatDateTimeWithArabicNumerals } from '../../utils/numberFormatting';

const EnhancedMessageScreen = ({ navigation }) => {
  const { userId, t, language, activeSessionId } = useContext(AppContext);
  const paperTheme = useTheme();
  const isFocused = useIsFocused();
  const [customers, setCustomers] = useState([]);
  const [userAreas, setUserAreas] = useState([]); // Changed from 'areas'
  const [areaETAs, setAreaETAs] = useState({});
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [sendingResults, setSendingResults] = useState(null);
  const [shouldStop, setShouldStop] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showETAModal, setShowETAModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [etaTime, setEtaTime] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0); // Set to 12:00 PM
    return date;
  });
  const [rangeEndTime, setRangeEndTime] = useState(() => {
    const date = new Date();
    date.setHours(13, 0, 0, 0); // Set to 1:00 PM
    return date;
  });
  const [etaFormat, setEtaFormat] = useState('range'); // 'single' | 'range'
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRangeEndPicker, setShowRangeEndPicker] = useState(false);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [etaStats, setEtaStats] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState('medium'); // Default to medium
  const [backgroundSending, setBackgroundSending] = useState(true); // Background sending is always on
  const [whatsappStatus, setWhatsappStatus] = useState({ 
    connected: false, 
    connecting: false,
    activeSessionId: null
  });
  const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(false);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selectedSessionForSending, setSelectedSessionForSending] = useState(null);
  
  // Enhanced ETA Management states
  const [showCopyETAModal, setShowCopyETAModal] = useState(false);
  const [selectedAreasToCopy, setSelectedAreasToCopy] = useState([]);
  const [showBulkETAModal, setShowBulkETAModal] = useState(false);
  const [bulkETAAction, setBulkETAAction] = useState('add'); // 'add' | 'deduct'
  const [etaSaving, setEtaSaving] = useState(false);

  useEffect(() => { 
    if (userId) loadData(); 
  }, [userId]);

  useEffect(() => {
    if (isFocused && userId) {
      console.log('📱 EnhancedMessageScreen loaded with userId:', userId);
      console.log('📱 UserId type:', typeof userId);
      console.log('📱 Active session ID:', activeSessionId);
      loadData();
      loadAvailableSessions(); // Load available sessions
      checkWhatsAppStatus(); // Check WhatsApp status when screen loads
      // Don't auto-check areas on every load - only when manually requested
    }
  }, [isFocused, userId, activeSessionId]);

  // Periodic WhatsApp status check when screen is focused
  useEffect(() => {
    let statusInterval;
    
    if (isFocused && userId && activeSessionId) {
      // Check status every 5 seconds when screen is focused and has active session
      statusInterval = setInterval(() => {
        checkWhatsAppStatus();
      }, 5000);
    }
    
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [isFocused, userId, activeSessionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 🔍 DEBUG: Areas table initialization removed - areas should be managed by admin only
      console.log('🔍 DEBUG: Skipping areas initialization - areas table is read-only for normal users');
      
      // Load current user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error loading user profile:', profileError);
      } else {
        setCurrentUserProfile(userProfile);
      }
      
      // Load customers
      const customersResponse = await customersAPI.getAll(userId);
      setCustomers(customersResponse.data.customers || []);
      
      // Load user areas with ETAs
      const userAreasResponse = await enhancedMessageAPI.getUserAreasWithETAs(userId);
      setUserAreas(userAreasResponse.data.areas || []);
      
      // Load area ETAs
      const areaETAsResponse = await enhancedMessageAPI.getUserAreaETAs(userId);
      const etasMap = {};
      (areaETAsResponse.data.etas || []).forEach(eta => {
        etasMap[eta.areaid] = eta.eta; // area_etas table uses areaid (lowercase)
      });
      setAreaETAs(etasMap);
      
      // Load ETA statistics
      const statsResponse = await enhancedMessageAPI.getUserETAStats(userId);
      setEtaStats(statsResponse.data);
      
      // Load message templates
      const templatesResponse = await messageTemplatesAPI.getAll(userId);
      setMessageTemplates(templatesResponse.data.templates || []);
      
      // Load user preferences
      const preferencesResponse = await messageTemplatesAPI.getUserPreferences(userId);
      setUserPreferences(preferencesResponse.data.preferences);
      
      // Set default template if available
      if (preferencesResponse.data.preferences?.default_template_id) {
        const defaultTemplate = templatesResponse.data.templates.find(
          t => t.id === preferencesResponse.data.preferences.default_template_id
        );
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
        }
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('error'), 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSessions = async () => {
    try {
      // Get all sessions for the user
      const { data: sessionsData, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sessions = sessionsData || [];
      console.log('🔍 Loaded available sessions:', sessions.length);
      
      // Check connection status for each session
      const sessionsWithStatus = await Promise.all(
        sessions.map(async (session) => {
          try {
            const response = await whatsappAPI.getStatus(userId, session.session_id);
            return {
              ...session,
              connected: response.data.connected,
              connecting: response.data.isConnecting
            };
          } catch (error) {
            console.log('⚠️ Error checking session status:', session.session_id, error.message);
            return {
              ...session,
              connected: false,
              connecting: false
            };
          }
        })
      );
      
      setAvailableSessions(sessionsWithStatus);
      
      // Auto-select the first connected session if none is selected
      if (!selectedSessionForSending) {
        const connectedSession = sessionsWithStatus.find(s => s.connected);
        if (connectedSession) {
          setSelectedSessionForSending(connectedSession);
          console.log('🎯 Auto-selected connected session:', connectedSession.session_id);
        } else if (sessionsWithStatus.length > 0) {
          setSelectedSessionForSending(sessionsWithStatus[0]);
          console.log('🎯 Auto-selected first session:', sessionsWithStatus[0].session_id);
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading available sessions:', error);
      setAvailableSessions([]);
    }
  };

  const getAreaName = (areaId, lang = language) => {
    const area = userAreas.find(a => a.areaId === areaId);
    if (area) {
      return areasAPI.getAreaName(area, lang);
    }
    // Fallback to areaId if area not found
    return `Area ${areaId}`;
  };

  const getAreaETA = (areaId) => {
    return areaETAs[areaId] || t('notSet');
  };

  const handleSetETA = (area) => {
    setSelectedArea(area);
    
    // Set default times to 12:00 and 13:00
    const defaultStartTime = new Date();
    defaultStartTime.setHours(12, 0, 0, 0);
    
    const defaultEndTime = new Date();
    defaultEndTime.setHours(13, 0, 0, 0);
    
    setEtaTime(defaultStartTime);
    setRangeEndTime(defaultEndTime);
    setEtaFormat('range'); // Default to range format
    setShowETAModal(true);
  };

  const handleSaveETA = async () => {
    if (!selectedArea) return;
    
    try {
      // Build ETA string based on format
      let etaString;
      if (etaFormat === 'single') {
        etaString = formatTimeWithArabicNumerals(etaTime);
      } else {
        etaString = `${formatTimeWithArabicNumerals(etaTime)} - ${formatTimeWithArabicNumerals(rangeEndTime)}`;
      }
      
      await enhancedMessageAPI.setAreaETA(
        selectedArea.areaId, 
        etaString, 
        userId
      );
      
      // Reload ETA data
      const areaETAsResponse = await enhancedMessageAPI.getUserAreaETAs(userId);
      const etasMap = {};
      (areaETAsResponse.data.etas || []).forEach(eta => {
        etasMap[eta.areaid] = eta.eta; // Use areaid (lowercase) for area_etas table
      });
      setAreaETAs(etasMap);
      
      // Reload ETA statistics
      const statsResponse = await enhancedMessageAPI.getUserETAStats(userId);
      setEtaStats(statsResponse.data);
      
      setShowETAModal(false);
      Alert.alert(t('success'), t('etaSavedSuccessfully'));
    } catch (error) {
      console.error('Error saving ETA:', error);
      Alert.alert(t('error'), 'Failed to save ETA: ' + error.message);
    }
  };

  const handleDeleteETA = async (areaId) => {
    try {
      await enhancedMessageAPI.deleteAreaETA(areaId, userId);
      
      // Reload ETA data
      const areaETAsResponse = await enhancedMessageAPI.getUserAreaETAs(userId);
      const etasMap = {};
      (areaETAsResponse.data.etas || []).forEach(eta => {
        etasMap[eta.areaid] = eta.eta;
      });
      setAreaETAs(etasMap);
      
      // Reload ETA statistics
      const statsResponse = await enhancedMessageAPI.getUserETAStats(userId);
      setEtaStats(statsResponse.data);
      
      Alert.alert(t('success'), t('etaDeletedSuccessfully'));
    } catch (error) {
      console.error('Error deleting ETA:', error);
      Alert.alert(t('error'), 'Failed to delete ETA: ' + error.message);
    }
  };

  // Helper functions for time manipulation
  const parseTimeString = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const addHourToTime = (date) => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + 1);
    return newDate;
  };

  const deductHourFromTime = (date) => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() - 1);
    return newDate;
  };

  const formatTimeFromDate = (date) => {
    return formatTimeWithArabicNumerals(date);
  };

  // Copy ETA to multiple areas
  const handleCopyETA = (sourceArea) => {
    if (!areaETAs[sourceArea.areaId]) {
      Alert.alert(t('error'), 'Please select an area with an existing ETA to copy');
      return;
    }
    setSelectedArea(sourceArea);
    setShowCopyETAModal(true);
  };

  const handleCopyToSelectedAreas = async () => {
    if (!selectedArea || selectedAreasToCopy.length === 0) return;
    
    setEtaSaving(true);
    try {
      const sourceETA = areaETAs[selectedArea.areaId];
      let successCount = 0;
      let errorCount = 0;

      for (const areaId of selectedAreasToCopy) {
        try {
          await enhancedMessageAPI.setAreaETA(areaId, sourceETA, userId);
          setAreaETAs(prev => ({ ...prev, [areaId]: sourceETA }));
          successCount++;
        } catch (error) {
          console.error(`Error copying ETA to area ${areaId}:`, error);
          errorCount++;
        }
      }

      Alert.alert(
        t('success'), 
        `ETA copied successfully!\n\n✅ Copied to: ${successCount} areas\n❌ Failed: ${errorCount} areas`
      );
      setShowCopyETAModal(false);
      setSelectedAreasToCopy([]);
    } catch (error) {
      console.error('Error copying ETA:', error);
      Alert.alert(t('error'), 'Failed to copy ETA to selected areas');
    } finally {
      setEtaSaving(false);
    }
  };

  // Bulk ETA operations (add/deduct hour)
  const handleBulkETAOperation = (action) => {
    if (Object.keys(areaETAs).length === 0) {
      Alert.alert(t('error'), 'No ETAs found to modify');
      return;
    }
    setBulkETAAction(action);
    setShowBulkETAModal(true);
  };

  const handleConfirmBulkETA = async () => {
    setEtaSaving(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [areaId, etaString] of Object.entries(areaETAs)) {
        try {
          let newETA;
          
          // Parse and modify the ETA
          if (etaString.includes('-')) {
            // Range format: "12:00-13:00"
            const [startStr, endStr] = etaString.split('-');
            const startTime = parseTimeString(startStr.trim());
            const endTime = parseTimeString(endStr.trim());
            
            const newStart = bulkETAAction === 'add' ? addHourToTime(startTime) : deductHourFromTime(startTime);
            const newEnd = bulkETAAction === 'add' ? addHourToTime(endTime) : deductHourFromTime(endTime);
            
            newETA = `${formatTimeFromDate(newStart)}-${formatTimeFromDate(newEnd)}`;
          } else {
            // Single time format: "12:00"
            const time = parseTimeString(etaString.trim());
            const newTime = bulkETAAction === 'add' ? addHourToTime(time) : deductHourFromTime(time);
            newETA = formatTimeFromDate(newTime);
          }

          await enhancedMessageAPI.setAreaETA(Number(areaId), newETA, userId);
          setAreaETAs(prev => ({ ...prev, [areaId]: newETA }));
          successCount++;
        } catch (error) {
          console.error(`Error updating ETA for area ${areaId}:`, error);
          errorCount++;
        }
      }

      Alert.alert(
        t('success'), 
        `ETAs updated successfully!\n\n✅ Updated: ${successCount} areas\n❌ Failed: ${errorCount} areas`
      );
      setShowBulkETAModal(false);
    } catch (error) {
      console.error('Error updating ETAs:', error);
      Alert.alert(t('error'), 'Failed to update ETAs');
    } finally {
      setEtaSaving(false);
    }
  };

  // Template management functions
  const handleSetDefaultTemplate = async (templateId) => {
    try {
      await messageTemplatesAPI.setDefaultTemplate(userId, templateId);
      
      // Reload preferences
      const preferencesResponse = await messageTemplatesAPI.getUserPreferences(userId);
      setUserPreferences(preferencesResponse.data.preferences);
      
      Alert.alert(t('success'), t('defaultTemplateSetSuccessfully'));
    } catch (error) {
      console.error('Error setting default template:', error);
      Alert.alert(t('error'), 'Failed to set default template: ' + error.message);
    }
  };

  const handleToggleFavoriteTemplate = async (templateId) => {
    try {
      await messageTemplatesAPI.toggleFavoriteTemplate(userId, templateId);
      
      // Reload preferences
      const preferencesResponse = await messageTemplatesAPI.getUserPreferences(userId);
      setUserPreferences(preferencesResponse.data.preferences);
      
      // Reload templates to update favorite status
      const templatesResponse = await messageTemplatesAPI.getAll(userId);
      setMessageTemplates(templatesResponse.data.templates || []);
    } catch (error) {
      console.error('Error toggling favorite template:', error);
      Alert.alert(t('error'), 'Failed to update favorite template: ' + error.message);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  const generatePreviewMessages = async () => {
    if (!selectedTemplate || customers.length === 0) {
      Alert.alert(t('noTemplateSelected'), t('pleaseSelectTemplate'));
      return;
    }

    try {
      const previews = [];
      
      for (const customer of customers.slice(0, 5)) { // Preview first 5 customers
        const areaId = customer.areaId; // customers table uses areaId (camelCase)
        const eta = areaETAs[areaId]; // This should work if the mapping is correct
        
        // Get localized template
        const localizedResponse = await enhancedMessageAPI.getLocalizedTemplate(
          selectedTemplate.id, 
          areaId, 
          userId
        );
        
        // Get customer's preferred languages and area info
        const customerWithLocalizedArea = await getCustomerWithLocalizedArea(customer);
        
        console.log(`\n🔤 Generating preview for customer ${customer.name} with languages:`, customerWithLocalizedArea.preferredLanguages);
        
        // Create customer object with area info
        const localizedCustomer = {
          ...customerWithLocalizedArea,
          area: customerWithLocalizedArea.area.name_english // Use English as base, will be localized per message
        };
        
        console.log(`📍 Area details for ${customer.name}:`);
        console.log(`   Original area: ${customer.area}`);
        console.log(`   Area object:`, {
          areaId: customerWithLocalizedArea.area.areaId,
          name_english: customerWithLocalizedArea.area.name_english,
          name_arabic: customerWithLocalizedArea.area.name_arabic,
          name_hebrew: customerWithLocalizedArea.area.name_hebrew,
          preferred_language_1: customerWithLocalizedArea.area.preferred_language_1,
          preferred_language_2: customerWithLocalizedArea.area.preferred_language_2
        });
        
        // Create multi-language messages (this handles all languages at once)
        const messages = enhancedMessageAPI.createMultiLanguageMessages(
          selectedTemplate, // Pass the full template object
          localizedCustomer,
          eta ? String(eta) : null,
          customerWithLocalizedArea.area
        );
        
        // Handle both single messages and arrays of messages
        const messagesToProcess = Array.isArray(messages) ? messages : [messages];
        
        for (let msgIndex = 0; msgIndex < messagesToProcess.length; msgIndex++) {
          const message = messagesToProcess[msgIndex];
          console.log(`📝 Preview message ${msgIndex + 1}/${messagesToProcess.length}:`, message.substring(0, 100) + '...');
          
          previews.push({
            customer: customer.name,
            message: message,
            language: customerWithLocalizedArea.preferredLanguages[msgIndex] || 'unknown',
            area: localizedCustomer.area,
            originalArea: customerWithLocalizedArea.originalArea,
            isMultiLanguage: customerWithLocalizedArea.preferredLanguages.length > 1
          });
        }
      }
      
      setPreviewMessages(previews);
    } catch (error) {
      console.error('Error generating preview messages:', error);
      Alert.alert(t('error'), 'Failed to generate preview messages: ' + error.message);
    }
  };

  const sendMessages = async () => {
    if (!selectedTemplate) {
      Alert.alert(t('error'), t('pleaseSelectTemplateToSend'));
      return;
    }

    // Check if a session is selected
    if (!selectedSessionForSending) {
      Alert.alert(
        t('noSessionSelected'),
        t('pleaseSelectSession'),
        [{ text: t('ok'), style: 'cancel' }]
      );
      return;
    }

    // Check if the selected session is connected
    if (!selectedSessionForSending.connected) {
      Alert.alert(
        t('sessionNotConnected'),
        t('sessionNotConnectedMessage').replace('{sessionName}', selectedSessionForSending.session_name || selectedSessionForSending.session_id),
        [
          { text: t('goToWhatsApp'), onPress: () => navigation.navigate('WhatsApp') },
          { text: t('cancel'), style: 'cancel' }
        ]
      );
      return;
    }

    const selectedDelay = speedDelays[selectedSpeed];
    
    // Calculate total messages (including multiple language versions)
    let totalMessages = 0;
    for (const customer of customers) {
      const area = userAreas.find(a => a.areaId === customer.areaId);
      if (area) {
        const languages = [];
        if (area.preferred_language_1) languages.push(area.preferred_language_1);
        if (area.preferred_language_2 && area.preferred_language_2 !== area.preferred_language_1) {
          languages.push(area.preferred_language_2);
        }
        totalMessages += Math.max(languages.length, 1);
      } else {
        totalMessages += 1; // Fallback to single message
      }
    }
    
    const estimatedTime = totalMessages * selectedDelay;
    const timeMessage = selectedDelay === 0 
      ? `Messages will be sent instantly (${totalMessages} total messages)`
      : `Estimated time: ${Math.floor(estimatedTime / 60)}m ${estimatedTime % 60}s (${totalMessages} total messages)`;

    Alert.alert(
      t('confirmSend'),
      `Send personalized messages to ${customers.length} customers?\n\nSpeed: ${selectedSpeed.charAt(0).toUpperCase() + selectedSpeed.slice(1)}\nDelay: ${selectedDelay} seconds\n${timeMessage}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('send'),
          onPress: async () => {
            setLoading(true);
            setSending(true);
            setShouldStop(false);
            setSendingProgress(0);
            setSendingResults(null);
            
            // Track message usage for time restrictions
            try {
              console.log('📊 Tracking message usage for time restrictions...');
              const trackResult = await timeRestrictionsAPI.trackMessageUsage(userId);
              if (trackResult.success) {
                console.log('✅ Message usage tracked successfully');
              } else {
                console.warn('⚠️ Failed to track message usage:', trackResult.error);
              }
            } catch (error) {
              console.warn('⚠️ Error tracking message usage:', error);
              // Don't stop sending if tracking fails
            }
            
            try {
              if (backgroundSending) {
                // Use background sending API
                try {
                  const customerIds = customers.map(customer => customer.id);
                  
                  // Process templates first to get personalized messages grouped by customer
                  const customerMessageMap = new Map();
                  
                  // Process each customer's message with proper template logic
                  for (const customer of customers) {
                    const areaId = customer.areaId;
                    const eta = areaETAs[areaId];
                    
                    // Get localized template based on area preferences
                    const localizedResponse = await enhancedMessageAPI.getLocalizedTemplate(
                      selectedTemplate.id, 
                      areaId, 
                      userId
                    );
                    
                    // Get customer's preferred languages and area info
                    const customerWithLocalizedArea = await getCustomerWithLocalizedArea(customer);
                    
                    console.log(`\n🔤 Processing messages for customer ${customer.name} with languages:`, customerWithLocalizedArea.preferredLanguages);
                    
                    // Create customer object with area info
                    const localizedCustomer = {
                      ...customerWithLocalizedArea,
                      area: customerWithLocalizedArea.area.name_english // Use English as base, will be localized per message
                    };
                    
                    console.log(`📍 Area details for ${customer.name}:`);
                    console.log(`   Original area: ${customer.area}`);
                    console.log(`   Area object:`, {
                      areaId: customerWithLocalizedArea.area.areaId,
                      name_english: customerWithLocalizedArea.area.name_english,
                      name_arabic: customerWithLocalizedArea.area.name_arabic,
                      name_hebrew: customerWithLocalizedArea.area.name_hebrew,
                      preferred_language_1: customerWithLocalizedArea.area.preferred_language_1,
                      preferred_language_2: customerWithLocalizedArea.area.preferred_language_2
                    });
                    
                    // Create multi-language messages (this handles all languages at once)
                    const personalizedMessage = enhancedMessageAPI.createMultiLanguageMessages(
                      selectedTemplate, // Pass the full template object
                      localizedCustomer,
                      eta ? String(eta) : null,
                      customerWithLocalizedArea.area
                    );
                    
                    // Handle both single messages and arrays of messages
                    const messagesToProcess = Array.isArray(personalizedMessage) ? personalizedMessage : [personalizedMessage];
                    const languagesForCustomer = customerWithLocalizedArea.preferredLanguages;
                    
                    // Group all messages for this customer
                    customerMessageMap.set(customer.id, {
                      customerId: customer.id,
                      name: customer.name,
                      phone: customer.phone,
                      phone2: customer.phone2,
                      messages: messagesToProcess,
                      languages: languagesForCustomer,
                      area: customerWithLocalizedArea.area
                    });
                    
                    console.log(`📝 Grouped ${messagesToProcess.length} messages for customer ${customer.name}`);
                  }
                  
                  // Convert map to array for backend
                  const processedMessagesForBackend = Array.from(customerMessageMap.values());
                  
                  console.log('🚀 Starting background message sending...', {
                    userId,
                    userIdType: typeof userId,
                    userIdLength: userId ? userId.length : 'null',
                    processedMessages: processedMessagesForBackend.length,
                    sampleMessage: processedMessagesForBackend[0]?.messages?.[0]?.substring(0, 100) + '...',
                    customerIds: customerIds.length,
                    speedDelay: selectedDelay
                  });
                  
                  // Send processed messages instead of raw template
                  const response = await messagesAPI.sendMessagesBackground(
                    userId, 
                    processedMessagesForBackend, 
                    customerIds, 
                    selectedDelay,
                    selectedSessionForSending?.session_id || null
                  );
                  
                  console.log('📱 Background sending response:', response);
                  console.log('📱 Response type:', typeof response);
                  console.log('📱 Response keys:', response ? Object.keys(response) : 'null/undefined');
                  console.log('📱 Response.data:', response?.data);
                  console.log('📱 Response.data keys:', response?.data ? Object.keys(response.data) : 'null/undefined');
                  
                  if (response && response.data && response.data.processId) {
                    Alert.alert(
                      t('backgroundSendingStarted'),
                      t('backgroundSendingStartedMessage').replace('{processId}', response.data.processId).replace('{totalCustomers}', response.data.totalCustomers).replace('{totalMessages}', processedMessagesForBackend.length).replace('{estimatedTime}', response.data.estimatedTime)
                    );
                    
                    setSendingResults({
                      sent: 0,
                      failed: 0,
                      total: customers.length,
                      stopped: false,
                      background: true,
                      processId: response.data.processId
                    });
                    
                    setLoading(false);
                    setSending(false);
                    return;
                  } else {
                    console.error('❌ Invalid response structure:', response);
                    throw new Error('Invalid response from background sending API - missing processId');
                  }
                } catch (backgroundError) {
                  console.error('❌ Background sending failed:', backgroundError);
                  Alert.alert(
                    t('backgroundSendingFailed'),
                    t('backgroundSendingFailedMessage').replace('{error}', backgroundError.message)
                  );
                  setLoading(false);
                  setSending(false);
                  return; // Do not fall back to regular sending
                }
              }

              // No direct update message; background process handles notifications

              let sentCount = 0;
              let failedCount = 0;
              const totalCustomers = customers.length;
              
              // No direct sending loop; background task handles actual delivery
              
              const results = {
                sent: sentCount,
                failed: failedCount,
                total: totalCustomers,
                stopped: shouldStop
              };
              
              setSendingResults(results);
              
              // No direct completion message; rely on server-side completion logs
              
              if (shouldStop) {
                Alert.alert(
                  t('sendStopped'),
                  `Sending stopped by user.\nSent: ${sentCount}\nFailed: ${failedCount}`
                );
              } else {
                Alert.alert(
                  t('sendComplete'),
                  `Sent: ${sentCount}\nFailed: ${failedCount}`
                );
              }
            } catch (error) {
              console.error('Error sending messages:', error);
              Alert.alert(t('error'), 'Failed to send messages: ' + error.message);
            } finally {
              setLoading(false);
              setSending(false);
            }
          },
        },
      ]
    );
  };

  // Speed delay mapping
  const speedDelays = {
    slow: 50,
    medium: 35,
    fast: 25,
    instant: 0
  };

  // Test background API availability
  const testBackgroundAPI = async () => {
    try {
      // Just check if WhatsApp is connected - that's all we need
      const isConnected = await checkWhatsAppStatus();
      if (!isConnected) {
        console.log('❌ Background API test failed: WhatsApp not connected');
        return false;
      }
      
      console.log('✅ Background API test passed: WhatsApp connected');
      return true;
    } catch (error) {
      console.log('❌ Background API test failed:', error.message);
      return false;
    }
  };

  // Check WhatsApp connection status
  const checkWhatsAppStatus = async () => {
    try {
      setWhatsappStatusLoading(true);
      
      // Check if there's an active session
      if (!activeSessionId) {
        console.log('⚠️ No active session selected for WhatsApp status check');
        
        // Try to find an active session automatically
        const activeSession = await findActiveSession();
        if (activeSession) {
          console.log('🔍 Found active session automatically:', activeSession.session_id);
          // Note: We can't set activeSessionId here as it's from context
          // But we can use this session for status check
          const response = await whatsappAPI.getStatus(userId, activeSession.session_id);
          console.log('📱 WhatsApp status response for auto-detected session:', activeSession.session_id, response);
          
          setWhatsappStatus({
            connected: response.data.connected,
            connecting: response.data.isConnecting,
            activeSessionId: activeSession.session_id
          });
          return response.data.connected;
        }
        
        setWhatsappStatus({ connected: false, connecting: false });
        return false;
      }

      // Get status for the active session
      const response = await whatsappAPI.getStatus(userId, activeSessionId);
      console.log('📱 WhatsApp status response for session:', activeSessionId, response);
      
      setWhatsappStatus({
        connected: response.data.connected,
        connecting: response.data.isConnecting,
        activeSessionId: activeSessionId
      });
      return response.data.connected;
    } catch (error) {
      console.error('❌ Failed to check WhatsApp status for session:', activeSessionId, error);
      setWhatsappStatus({ connected: false, connecting: false });
      return false;
    } finally {
      setWhatsappStatusLoading(false);
    }
  };

  // Find active session automatically
  const findActiveSession = async () => {
    try {
      // Get all sessions for the user
      const { data: sessionsData, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sessions = sessionsData || [];
      console.log('🔍 Found sessions:', sessions.length);
      
      if (sessions.length === 0) {
        Alert.alert(t('noSessions'), t('noSessionsFound'));
        return null;
      }
      
      // First try to find a connected session
      for (const session of sessions) {
        try {
          const response = await whatsappAPI.getStatus(userId, session.session_id);
          if (response.data.connected) {
            console.log('✅ Found connected session:', session.session_id);
            // Update the status display
            setWhatsappStatus({
              connected: response.data.connected,
              connecting: response.data.isConnecting,
              activeSessionId: session.session_id
            });
            return session;
          }
        } catch (error) {
          console.log('⚠️ Error checking session status:', session.session_id, error.message);
        }
      }
      
      // If no connected session, return the first active session
      if (sessions.length > 0) {
        console.log('📱 No connected session found, using first active session:', sessions[0].session_id);
        return sessions[0];
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error finding active session:', error);
      Alert.alert('Error', 'Failed to find active session: ' + error.message);
      return null;
    }
  };

  // Get customer with localized area name based on preferred language
  const getCustomerWithLocalizedArea = async (customer) => {
    try {
      // Get the area details from userAreas
      const area = userAreas.find(a => a.areaId === customer.areaId);
      
      console.log(`🔍 DEBUG getCustomerWithLocalizedArea for customer ${customer.name}:`);
      console.log(`   - customer.areaId:`, customer.areaId);
      console.log(`   - Found area:`, area);
      console.log(`   - area.preferred_language_1:`, area?.preferred_language_1);
      console.log(`   - area.preferred_language_2:`, area?.preferred_language_2);
      
      if (!area) {
        console.warn(`⚠️ Area not found for customer ${customer.name} (areaId: ${customer.areaId})`);
        return customer; // Return original customer if area not found
      }

      // Determine the customer's preferred languages
      let preferredLanguages = ['en']; // Default to English
      
      // Check if customer has preferred languages
      if (customer.preferred_language) {
        const lang = customer.preferred_language.trim();
        if (lang) preferredLanguages = [lang];
      } else if (customer.language) {
        const lang = customer.language.trim();
        if (lang) preferredLanguages = [lang];
      } else {
        // Use area's preferred languages as fallback
        preferredLanguages = [];
        if (area.preferred_language_1) {
          const lang1 = area.preferred_language_1.trim();
          if (lang1) preferredLanguages.push(lang1);
        }
        if (area.preferred_language_2) {
          const lang2 = area.preferred_language_2.trim();
          if (lang2 && lang2 !== area.preferred_language_1?.trim()) {
            preferredLanguages.push(lang2);
          }
        }
        if (preferredLanguages.length === 0) preferredLanguages = ['en'];
      }

      console.log(`🌍 Customer ${customer.name} - Preferred languages:`, preferredLanguages);
      console.log(`🌍 Area details:`, {
        areaId: area.areaId,
        name_english: area.name_english,
        name_arabic: area.name_arabic,
        name_hebrew: area.name_hebrew,
        preferred_language_1: area.preferred_language_1,
        preferred_language_2: area.preferred_language_2
      });
      
      // Debug: Check if the area has the expected Hebrew name
      if (area.name_hebrew && area.name_hebrew !== area.name_english) {
        console.log(`✅ Area ${area.areaId} has Hebrew name: "${area.name_hebrew}"`);
      } else {
        console.warn(`⚠️ Area ${area.areaId} missing or duplicate Hebrew name:`, {
          name_hebrew: area.name_hebrew,
          name_english: area.name_english,
          isDuplicate: area.name_hebrew === area.name_english
        });
      }

      // Return customer with preferred languages and area info
      return {
        ...customer,
        originalArea: customer.area, // Keep original for reference
        preferredLanguages: preferredLanguages,
        area: area // Pass full area object for localization
      };
    } catch (error) {
      console.error(`❌ Error localizing area for customer ${customer.name}:`, error);
      return customer; // Return original customer if error occurs
    }
  };

  // Get localized area name for a specific language
  const getLocalizedAreaName = (area, language) => {
    if (!area) return t('unknownArea');
    
    let localizedName;
    
    // Force strict language matching - no fallbacks to other languages
    switch (language) {
      case 'ar':
        // For Arabic, ONLY use Arabic name
        localizedName = area.name_arabic;
        if (!localizedName) {
          console.warn(`❌ Arabic name not available for area ${area.areaId}, using 'Unknown Area'`);
          localizedName = t('unknownArea');
        }
        break;
        
      case 'he':
        // For Hebrew, ONLY use Hebrew name
        localizedName = area.name_hebrew;
        if (!localizedName) {
          console.warn(`❌ Hebrew name not available for area ${area.areaId}, using 'Unknown Area'`);
          localizedName = t('unknownArea');
        }
        break;
        
      case 'en':
      default:
        // For English, ONLY use English name
        localizedName = area.name_english;
        if (!localizedName) {
          console.warn(`❌ English name not available for area ${area.areaId}, using 'Unknown Area'`);
          localizedName = t('unknownArea');
        }
        break;
    }
    
    // Log the strict localization
    console.log(`🌍 Area ${area.areaId} STRICTLY localized for ${language}: "${area.name_english}" -> "${localizedName}"`);
    
    return localizedName;
  };

  const stopSending = () => {
    setShouldStop(true);
    Alert.alert(t('stopping'), 'Stopping message sending...');
  };

  // Check and add missing areas (like Kfar Saba)
  const checkAndAddMissingAreas = async () => {
    try {
      console.log('🔍 Checking for missing areas...');
      
      // First, let's see what areas we currently have
      console.log('📊 Current areas in database:', userAreas.map(a => ({
        areaId: a.areaId,
        name_english: a.name_english,
        name_hebrew: a.name_hebrew,
        name_arabic: a.name_arabic
      })));
      
      // Check if Kfar Saba exists (by any name variation)
      const kfarSabaExists = userAreas.find(area => 
        area.name_english === 'Kfar Saba' || 
        area.name_hebrew === 'כפר סבא' ||
        area.name_arabic === 'كفر سابا' ||
        area.name_english?.toLowerCase().includes('kfar') ||
        area.name_hebrew?.includes('כפר')
      );
      
      if (!kfarSabaExists) {
        console.log('⚠️ Kfar Saba area not found - areas table is read-only for normal users');
        console.log('ℹ️ Please contact admin to add missing areas to the areas table');
        // Don't try to insert - areas table should be read-only for normal users
      } else {
        console.log('✅ Kfar Saba area already exists:', kfarSabaExists);
      }
      
      // Areas table is read-only for normal users
      // All area modifications must be done by admin
      console.log('ℹ️ Areas table is read-only - no modifications allowed for normal users');
      
    } catch (error) {
      console.error('❌ Error checking/adding missing areas:', error);
    }
  };

  // Verify all areas have proper names in all languages
  const verifyAreaNames = () => {
    console.log('🔍 Verifying area names for all languages...');
    
    userAreas.forEach(area => {
      console.log(`\n📍 Area ${area.areaId}: ${area.name_english}`);
      
      // Check Hebrew
      if (area.name_hebrew && area.name_hebrew !== area.name_english) {
        console.log(`   ✅ Hebrew: ${area.name_english}`);
      } else {
        console.warn(`   ❌ Hebrew: ${area.name_hebrew || 'MISSING'} (should be different from English)`);
      }
      
      // Check Arabic
      if (area.name_arabic && area.name_arabic !== area.name_english) {
        console.log(`   ✅ Arabic: ${area.name_arabic}`);
      } else {
        console.warn(`   ❌ Arabic: ${area.name_arabic || 'MISSING'} (should be different from English)`);
      }
      
      // Check English
      console.log(`   ✅ English: ${area.name_english}`);
      
      // Check if this area supports multiple languages
      const supportsMultipleLanguages = (area.name_hebrew && area.name_hebrew !== area.name_english) ||
                                      (area.name_arabic && area.name_arabic !== area.name_english);
      
      if (supportsMultipleLanguages) {
        console.log(`   🌍 Supports multiple languages: YES`);
      } else {
        console.warn(`   🌍 Supports multiple languages: NO (all names are the same)`);
      }
    });
    
    // Test area localization for a sample area
    if (userAreas.length > 0) {
      const sampleArea = userAreas[0];
      console.log(`\n🧪 Testing area localization for: ${sampleArea.name_english}`);
      
      const hebrewName = getLocalizedAreaName(sampleArea, 'he');
      const englishName = getLocalizedAreaName(sampleArea, 'en');
      const arabicName = getLocalizedAreaName(sampleArea, 'ar');
      
      console.log(`   Hebrew (he): "${hebrewName}"`);
      console.log(`   English (en): "${englishName}"`);
      console.log(`   Arabic (ar): "${arabicName}"`);
      
      // Check if names are different
      if (hebrewName !== englishName && hebrewName !== t('unknownArea')) {
        console.log(`   ✅ Hebrew and English names are different`);
      } else {
        console.warn(`   ❌ Hebrew and English names are the same or missing`);
      }
    }
  };

  const renderTemplateCard = (template) => {
    // Get template text based on current language
    let templateText = '';
    if (language === 'ar') {
      templateText = template.template_arabic || template.template_hebrew || template.template_english;
    } else if (language === 'he') {
      templateText = template.template_hebrew || template.template_arabic || template.template_english;
    } else {
      templateText = template.template_english || template.template_arabic || template.template_hebrew;
    }

    return (
      <Card 
        key={template.id} 
        style={[
          dynamicStyles.templateCard, 
          selectedTemplate?.id === template.id && dynamicStyles.selectedTemplateCard
        ]}
        onPress={() => handleSelectTemplate(template)}
      >
        <Card.Content>
          <Text style={dynamicStyles.templateName}>{template.name}</Text>
          <Text style={dynamicStyles.templateText} numberOfLines={3}>{templateText}</Text>
          <View style={dynamicStyles.templateFlags}>
            {template.is_default && (
              <Chip mode="outlined" textStyle={{ fontSize: 10 }} style={dynamicStyles.flagChip}>
                Default
              </Chip>
            )}
            {template.is_favorite && (
              <Chip mode="outlined" textStyle={{ fontSize: 10 }} style={dynamicStyles.flagChip}>
                Favorite
              </Chip>
            )}
            {template.is_global && (
              <Chip mode="outlined" textStyle={{ fontSize: 10 }} style={dynamicStyles.flagChip}>
                Global
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPreviewMessage = (preview, index) => (
    <Card key={index} style={[dynamicStyles.previewCard, preview.isMultiLanguage && dynamicStyles.multiLanguageCard]}>
      <Card.Content>
        <View style={dynamicStyles.previewHeader}>
          <Text style={dynamicStyles.previewCustomer}>{preview.customer}</Text>
          <View style={dynamicStyles.languageBadge}>
            <Text style={dynamicStyles.languageText}>
              {preview.language === 'ar' ? '🇸🇦 العربية' : 
               preview.language === 'he' ? '🇮🇱 עברית' : 
               '🇺🇸 English'}
            </Text>
          </View>
        </View>
        <Text style={dynamicStyles.previewArea}>
          📍 Area: {preview.area}
          {preview.isMultiLanguage && preview.originalArea !== preview.area && 
            ` (Original: ${preview.originalArea})`}
        </Text>
        <Text style={dynamicStyles.previewMessage}>{preview.message}</Text>
        {preview.isMultiLanguage && (
          <Text style={dynamicStyles.multiLanguageNote}>
            🌍 Customer will receive {preview.isMultiLanguage ? 'multiple language versions' : 'this language version'}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <ScrollView style={dynamicStyles.container}>

      {/* WhatsApp Session Selector */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('chooseWhatsAppSession')}</Text>
            <View style={dynamicStyles.sectionActions}>
              <Button 
                mode="outlined" 
                onPress={loadAvailableSessions}
                style={dynamicStyles.refreshButton}
                icon="refresh"
                compact
              >
                Refresh
              </Button>
            </View>
          </View>
          <Divider style={dynamicStyles.divider} />
          {availableSessions.length === 0 ? (
            <View style={dynamicStyles.noSessionsContainer}>
              <Text style={dynamicStyles.noSessionsText}>{t('noSessionsFound')}</Text>
              <Text style={dynamicStyles.noSessionsHelp}>
                {t('goToWhatsAppTab')}
              </Text>
            </View>
          ) : (
            <View style={dynamicStyles.sessionsList}>
              {availableSessions.map((session) => (
                <TouchableOpacity
                  key={session.session_id}
                  style={[
                    dynamicStyles.sessionButton,
                    selectedSessionForSending?.session_id === session.session_id && dynamicStyles.selectedSessionButton
                  ]}
                  onPress={() => setSelectedSessionForSending(session)}
                >
                  <View style={dynamicStyles.sessionButtonContent}>
                    <View style={dynamicStyles.sessionInfo}>
                      <Text style={[
                        dynamicStyles.sessionName,
                        selectedSessionForSending?.session_id === session.session_id && dynamicStyles.selectedSessionName
                      ]}>
                        {session.session_name || session.session_id}
                      </Text>
                      <Text style={dynamicStyles.sessionId}>
                        {session.session_id}
                      </Text>
                    </View>
                    <View style={dynamicStyles.sessionStatus}>
                      <View style={[
                        dynamicStyles.sessionStatusDot,
                        { backgroundColor: session.connected ? '#25D366' : session.connecting ? '#FFA500' : '#FF3B30' }
                      ]} />
                      <Text style={[
                        dynamicStyles.sessionStatusText,
                        { color: session.connected ? '#25D366' : session.connecting ? '#FFA500' : '#FF3B30' }
                      ]}>
                        {session.connected ? t('connected') : session.connecting ? t('connecting') : t('disconnected')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedSessionForSending && (
            <View style={dynamicStyles.selectedSessionInfo}>
              <Text style={dynamicStyles.selectedSessionLabel}>Selected for sending:</Text>
              <Text style={dynamicStyles.selectedSessionName}>
                {selectedSessionForSending.session_name || selectedSessionForSending.session_id}
              </Text>
              <Text style={[
                dynamicStyles.selectedSessionStatus,
                { color: selectedSessionForSending.connected ? '#25D366' : '#FF3B30' }
              ]}>
                {selectedSessionForSending.connected ? '✅ Ready to send' : '❌ Not connected'}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Enhanced ETA Management Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('yourAreaETAs')}</Text>
            <View style={dynamicStyles.sectionActions}>
              <Button 
                mode="contained" 
                onPress={() => navigation.navigate('AddETA')}
                style={dynamicStyles.addButton}
                icon="plus"
                compact
              >
                {t('Add ETA')}
              </Button>
            </View>
          </View>
          
          {/* Bulk Operations */}
          {Object.keys(areaETAs).length > 0 && (
            <>
              <Divider style={dynamicStyles.divider} />
              <View style={dynamicStyles.bulkOperationsContainer}>
                <Text style={dynamicStyles.bulkOperationsTitle}>Bulk Operations:</Text>
                <View style={dynamicStyles.bulkButtonsRow}>
                  <Button 
                    mode="outlined" 
                    onPress={() => handleBulkETAOperation('add')}
                    style={[dynamicStyles.bulkButton, dynamicStyles.addHourButton]}
                    icon="clock-plus"
                    compact
                    disabled={etaSaving}
                  >
                    +1 Hour All
                  </Button>
                  <Button 
                    mode="outlined" 
                    onPress={() => handleBulkETAOperation('deduct')}
                    style={[dynamicStyles.bulkButton, dynamicStyles.deductHourButton]}
                    icon="clock-minus"
                    compact
                    disabled={etaSaving}
                  >
                    -1 Hour All
                  </Button>
                </View>
              </View>
            </>
          )}
          
          <Divider style={dynamicStyles.divider} />
          {userAreas.length === 0 ? (
            <Text style={dynamicStyles.noDataText}>No areas found for your customers</Text>
          ) : (
            userAreas.map(area => {
              const areaName = areasAPI.getAreaName(area, 'ar'); // Always show Arabic names in ETA list
              const eta = getAreaETA(area.areaId);
              const hasETA = areaETAs[area.areaId];
              return (
                <List.Item
                  key={area.areaId}
                  title={areaName}
                  description={`ETA: ${eta}`}
                  left={(props) => <Ionicons name="time" size={24} color={hasETA ? "#25D366" : "#666"} />}
                  right={(props) => (
                    <View style={dynamicStyles.etaActions}>
                      <TouchableOpacity onPress={() => handleSetETA(area)} style={dynamicStyles.addButton}>
                        <Ionicons name="add" size={20} color="#25D366" />
                      </TouchableOpacity>
                      
                      {hasETA && (
                        <>
                          <TouchableOpacity onPress={() => handleCopyETA(area)} style={dynamicStyles.copyButton}>
                            <Ionicons name="copy" size={20} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteETA(area.areaId)} style={dynamicStyles.deleteButton}>
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                  style={[dynamicStyles.areaItem, hasETA && dynamicStyles.areaItemWithETA]}
                />
              );
            })
          )}
        </Card.Content>
      </Card>

      {/* Message Templates Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>Message Templates</Text>
          <Divider style={dynamicStyles.divider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.templatesContainer}>
            {messageTemplates.map(renderTemplateCard)}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Template Preview Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>{t('templatePreview')}</Text>
          <Divider style={dynamicStyles.divider} />
          {selectedTemplate ? (
            <View style={dynamicStyles.templatePreviewContainer}>
              <Text style={dynamicStyles.templatePreviewTitle}>Selected Template: {selectedTemplate.name}</Text>
              <View style={dynamicStyles.templatePreviewContent}>
                <Text style={dynamicStyles.templatePreviewText}>
                  {language === 'ar' 
                    ? (selectedTemplate.template_arabic || selectedTemplate.template_hebrew || selectedTemplate.template_english)
                    : language === 'he' 
                    ? (selectedTemplate.template_hebrew || selectedTemplate.template_arabic || selectedTemplate.template_english)
                    : (selectedTemplate.template_english || selectedTemplate.template_arabic || selectedTemplate.template_hebrew)
                  }
                </Text>
              </View>
              <Text style={dynamicStyles.templatePreviewNote}>
                💡 This template will be personalized for each customer based on their area's preferred language(s)
              </Text>
            </View>
          ) : (
            <View style={dynamicStyles.noTemplateContainer}>
              <Text style={dynamicStyles.noTemplateText}>{t('noTemplateSelected')}</Text>
              <Text style={dynamicStyles.noTemplateHelp}>
                {t('pleaseSelectTemplateToPreview')}
              </Text>
            </View>
          )}
          {/* WhatsApp Connection Status */}
          <View style={dynamicStyles.connectionSection}>
            <View style={dynamicStyles.connectionHeader}>
              <Text style={dynamicStyles.connectionTitle}>{t('whatsAppStatus')}</Text>
              <View style={dynamicStyles.connectionActions}>
                <TouchableOpacity
                  style={dynamicStyles.refreshButton}
                  onPress={checkWhatsAppStatus}
                  disabled={whatsappStatus.connecting}
                >
                  <Ionicons 
                    name="refresh" 
                    size={16} 
                    color={whatsappStatus.connecting ? '#999' : '#007AFF'} 
                  />
                </TouchableOpacity>
                <View style={[
                  dynamicStyles.connectionIndicator,
                  { backgroundColor: selectedSessionForSending?.connected ? '#25D366' : '#FF3B30' }
                ]} />
              </View>
            </View>
            <Text style={[
              dynamicStyles.connectionStatus,
              { color: selectedSessionForSending?.connected ? '#25D366' : '#FF3B30' }
            ]}>
              {selectedSessionForSending 
                ? (selectedSessionForSending.connected 
                  ? `✅ Connected - Ready to send from "${selectedSessionForSending.session_name || selectedSessionForSending.session_id}"`
                  : `❌ ${t('notConnected')} - "${selectedSessionForSending.session_name || selectedSessionForSending.session_id}" ${t('needsToBeConnected')}`)
                : '❌ No session selected - Choose a session above'
              }
            </Text>
          </View>

          {/* Speed Selection */}
          <View style={dynamicStyles.speedSection}>
            <Text style={dynamicStyles.speedTitle}>{t('sendingSpeed')}:</Text>
            <View style={dynamicStyles.speedOptions}>
              {[
                { key: 'slow', label: t('slow'), delay: 50, description: '50s' },
                { key: 'medium', label: t('medium'), delay: 35, description: '35s' },
                { key: 'fast', label: t('fast'), delay: 25, description: '25s' },
                { key: 'instant', label: t('instant'), delay: 0, description: '0s' }
              ].map((speed) => (
                <TouchableOpacity
                  key={speed.key}
                  style={[
                    dynamicStyles.speedOption,
                    selectedSpeed === speed.key && dynamicStyles.speedOptionSelected
                  ]}
                  onPress={() => setSelectedSpeed(speed.key)}
                >
                  <Text style={[
                    dynamicStyles.speedOptionLabel,
                    selectedSpeed === speed.key && dynamicStyles.speedOptionLabelSelected
                  ]}>
                    {speed.label}
                  </Text>
                  <Text style={[
                    dynamicStyles.speedOptionDescription,
                    selectedSpeed === speed.key && dynamicStyles.speedOptionDescriptionSelected
                  ]}>
                    {speed.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Background Sending Option */}
          <View style={dynamicStyles.backgroundSection}>
            <View style={dynamicStyles.backgroundHeader}>
              <Text style={dynamicStyles.backgroundTitle}>{t('backgroundSending')}</Text>
              <TouchableOpacity
                style={[
                  dynamicStyles.backgroundToggle,
                  backgroundSending && dynamicStyles.backgroundToggleActive
                ]}
                onPress={async () => {
                  if (!backgroundSending) {
                    // Check if a session is selected and connected
                    if (!selectedSessionForSending) {
                      Alert.alert(
                        t('noSessionSelected'),
                        'Please select a WhatsApp session to use background sending.',
                        [{ text: t('ok'), onPress: () => setBackgroundSending(false) }]
                      );
                      return;
                    }
                    
                    if (!selectedSessionForSending.connected) {
                      Alert.alert(
                        t('sessionNotConnected'),
                        `The selected session "${selectedSessionForSending.session_name || selectedSessionForSending.session_id}" is not connected.\n\nPlease go to the WhatsApp tab and connect this session first.`,
                        [
                          { text: t('goToWhatsApp'), onPress: () => navigation.navigate('WhatsApp') },
                          { text: t('cancel'), onPress: () => setBackgroundSending(false) }
                        ]
                      );
                      return;
                    }
                    
                    // Test if background API is available
                    const isAvailable = await testBackgroundAPI();
                    if (!isAvailable) {
                      Alert.alert(
                        t('backgroundAPIUnavailable'),
                        'The background sending feature is not available. Please ensure the server is running and the background API endpoint is accessible.\n\nFalling back to regular sending mode.',
                        [{ text: t('ok'), onPress: () => setBackgroundSending(false) }]
                      );
                      return;
                    }
                  }
                  setBackgroundSending(!backgroundSending);
                }}
              >
                <View style={[
                  dynamicStyles.backgroundToggleThumb,
                  backgroundSending && dynamicStyles.backgroundToggleThumbActive
                ]} />
              </TouchableOpacity>
            </View>
            <Text style={dynamicStyles.backgroundDescription}>
              {backgroundSending 
                ? '✅ Messages will continue even if app is closed'
                : '❌ Messages will stop if app is closed'
              }
            </Text>
            <Text style={[
              dynamicStyles.backgroundNote,
              { color: selectedSessionForSending?.connected ? '#25D366' : '#FF3B30' }
            ]}>
              {selectedSessionForSending?.connected 
                ? '✅ WhatsApp Connected - Background sending available'
                : selectedSessionForSending
                ? '❌ Selected session not connected - Connect first to use background sending'
                : '❌ No session selected - Choose a session first'
              }
            </Text>
          </View>

          <View style={dynamicStyles.messageActions}>
            <Button 
              mode="outlined" 
              onPress={generatePreviewMessages}
              loading={loading}
              style={dynamicStyles.actionButton}
            >
              Generate Preview
            </Button>
            {!sending ? (
              <Button 
                mode="contained" 
                onPress={sendMessages}
                loading={loading}
                style={dynamicStyles.actionButton}
              >
                {t('sendMessages')} ({customers.length})
              </Button>
            ) : (
              <Button 
                mode="contained" 
                onPress={stopSending}
                style={[dynamicStyles.actionButton, dynamicStyles.stopButton]}
                icon="stop"
              >
                Stop Sending
              </Button>
            )}
          </View>
          
          {/* Progress Bar */}
          {sending && (
            <View style={dynamicStyles.progressContainer}>
              <View style={dynamicStyles.progressBar}>
                <View style={[dynamicStyles.progressFill, { width: `${sendingProgress}%` }]} />
              </View>
              <Text style={dynamicStyles.progressText}>
                {Math.round(sendingProgress)}% ({Math.round((sendingProgress / 100) * customers.length)}/{customers.length})
              </Text>
            </View>
          )}
          
          {/* Results Display */}
          {sendingResults && (
            <View style={dynamicStyles.resultsContainer}>
              <Text style={dynamicStyles.resultsTitle}>Sending Results:</Text>
              <Text style={dynamicStyles.resultsText}>
                {sendingResults.background ? (
                  `🔄 Background Process Started\n📱 Process ID: ${sendingResults.processId}\n📊 Total: ${sendingResults.total}\n\nMessages will continue in background`
                ) : (
                  `✅ Sent: ${sendingResults.sent}\n❌ Failed: ${sendingResults.failed}\n📊 Total: ${sendingResults.total}${sendingResults.stopped ? '\n🛑 Stopped by user' : ''}`
                )}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Preview Messages Section */}
      {previewMessages.length > 0 && (
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <Text style={dynamicStyles.sectionTitle}>Message Preview</Text>
            <Divider style={dynamicStyles.divider} />
            {previewMessages.map(renderPreviewMessage)}
          </Card.Content>
        </Card>
      )}

      {/* ETA Modal */}
      <Portal>
        <Modal
          visible={showETAModal}
          onDismiss={() => setShowETAModal(false)}
          contentContainerStyle={dynamicStyles.modal}
        >
        <View style={dynamicStyles.modalContent}>
          <Text style={dynamicStyles.modalTitle}>
            Set ETA for {selectedArea ? areasAPI.getAreaName(selectedArea, 'ar') : ''}
          </Text>
          
          {/* ETA Format Selection */}
          <View style={dynamicStyles.etaFormatSection}>
            <Text style={dynamicStyles.etaFormatTitle}>ETA Format:</Text>
            <View style={dynamicStyles.etaFormatOptions}>
              <TouchableOpacity
                style={[
                  dynamicStyles.etaFormatOption,
                  etaFormat === 'single' && dynamicStyles.etaFormatOptionSelected
                ]}
                onPress={() => setEtaFormat('single')}
              >
                <Text style={[
                  dynamicStyles.etaFormatOptionText,
                  etaFormat === 'single' && dynamicStyles.etaFormatOptionTextSelected
                ]}>
                  Single Time
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.etaFormatOption,
                  etaFormat === 'range' && dynamicStyles.etaFormatOptionSelected
                ]}
                onPress={() => setEtaFormat('range')}
              >
                <Text style={[
                  dynamicStyles.etaFormatOptionText,
                  etaFormat === 'range' && dynamicStyles.etaFormatOptionTextSelected
                ]}>
                  Time Range
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Time Selection */}
          <View style={dynamicStyles.timeSelectionSection}>
            <Text style={dynamicStyles.timeSelectionTitle}>Select Time:</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={dynamicStyles.timePickerButton}>
              <Text style={dynamicStyles.timePickerText}>
                {formatTimeWithArabicNumerals(etaTime)}
              </Text>
              <Ionicons name="time" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {/* Range End Time (if range format selected) */}
          {etaFormat === 'range' && (
            <View style={dynamicStyles.rangeEndSection}>
              <Text style={dynamicStyles.rangeEndTitle}>End Time:</Text>
              <TouchableOpacity onPress={() => setShowRangeEndPicker(true)} style={dynamicStyles.timePickerButton}>
                <Text style={dynamicStyles.timePickerText}>
                  {formatTimeWithArabicNumerals(rangeEndTime)}
                </Text>
                <Ionicons name="time" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Preview */}
          <View style={dynamicStyles.etaPreviewSection}>
            <Text style={dynamicStyles.etaPreviewTitle}>Preview:</Text>
            <Text style={dynamicStyles.etaPreviewText}>
              {etaFormat === 'single' 
                ? `ETA: ${formatTimeWithArabicNumerals(etaTime)}`
                : `ETA: ${formatTimeWithArabicNumerals(etaTime)} - ${formatTimeWithArabicNumerals(rangeEndTime)}`
              }
            </Text>
          </View>

          <View style={dynamicStyles.modalActions}>
            <Button mode="outlined" onPress={() => setShowETAModal(false)} style={dynamicStyles.modalButton}>
              {t('cancel')}
            </Button>
            <Button mode="contained" onPress={handleSaveETA} style={dynamicStyles.modalButton}>
              {t('saveETA')}
            </Button>
          </View>
        </View>
        </Modal>
      </Portal>

      {/* Time Picker - Web compatible */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          onDismiss={() => setShowTimePicker(false)}
          contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 }}
        >
          <Text style={{ fontSize: 18, marginBottom: 16 }}>Select Start Time</Text>
          <TextInput
            mode="outlined"
            label="Time (HH:MM)"
            placeholder="12:00"
            value={etaTime ? `${etaTime.getHours().toString().padStart(2, '0')}:${etaTime.getMinutes().toString().padStart(2, '0')}` : ''}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              if (hours && minutes) {
                const newTime = new Date();
                newTime.setHours(parseInt(hours) || 0);
                newTime.setMinutes(parseInt(minutes) || 0);
                setEtaTime(newTime);
              }
            }}
            style={{ marginBottom: 16 }}
          />
          <WebCompatibleButton mode="contained" onPress={() => setShowTimePicker(false)}>
            Done
          </WebCompatibleButton>
        </Modal>
      )}

      {/* Range End Time Picker - Web compatible */}
      {showRangeEndPicker && (
        <Modal
          visible={showRangeEndPicker}
          onDismiss={() => setShowRangeEndPicker(false)}
          contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 }}
        >
          <Text style={{ fontSize: 18, marginBottom: 16 }}>Select End Time</Text>
          <TextInput
            mode="outlined"
            label="Time (HH:MM)"
            placeholder="13:00"
            value={rangeEndTime ? `${rangeEndTime.getHours().toString().padStart(2, '0')}:${rangeEndTime.getMinutes().toString().padStart(2, '0')}` : ''}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              if (hours && minutes) {
                const newTime = new Date();
                newTime.setHours(parseInt(hours) || 0);
                newTime.setMinutes(parseInt(minutes) || 0);
                setRangeEndTime(newTime);
              }
            }}
            style={{ marginBottom: 16 }}
          />
          <WebCompatibleButton mode="contained" onPress={() => setShowRangeEndPicker(false)}>
            Done
          </WebCompatibleButton>
        </Modal>
      )}

      {/* Copy ETA Modal */}
      <Portal>
        <Modal
          visible={showCopyETAModal}
          onDismiss={() => {
            setShowCopyETAModal(false);
            setSelectedAreasToCopy([]);
          }}
          contentContainerStyle={dynamicStyles.modal}
        >
        <View style={dynamicStyles.modalContent}>
          <Text style={dynamicStyles.modalTitle}>Copy ETA to Other Areas</Text>
          <Text style={dynamicStyles.modalSubtitle}>
            Select areas to copy "{selectedArea ? areaETAs[selectedArea.areaId] : ''}" to:
          </Text>
          
          <ScrollView style={dynamicStyles.areaButtonsContainer} showsVerticalScrollIndicator={false}>
            {userAreas
              .filter(area => area.areaId !== selectedArea?.areaId)
              .map(area => (
                <Button
                  key={area.areaId}
                  mode={selectedAreasToCopy.includes(area.areaId) ? 'contained' : 'outlined'}
                  onPress={() => {
                    setSelectedAreasToCopy(prev => 
                      prev.includes(area.areaId)
                        ? prev.filter(id => id !== area.areaId)
                        : [...prev, area.areaId]
                    );
                  }}
                  style={[
                    dynamicStyles.areaButton,
                    selectedAreasToCopy.includes(area.areaId) && dynamicStyles.selectedAreaButton
                  ]}
                  labelStyle={dynamicStyles.areaButtonLabel}
                >
                  {areasAPI.getAreaName(area, 'ar')}
                  {areaETAs[area.areaId] && ` (${areaETAs[area.areaId]})`}
                </Button>
              ))}
          </ScrollView>

          <View style={dynamicStyles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowCopyETAModal(false);
                setSelectedAreasToCopy([]);
              }}
              style={dynamicStyles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCopyToSelectedAreas}
              loading={etaSaving}
              disabled={etaSaving || selectedAreasToCopy.length === 0}
              style={dynamicStyles.modalButton}
            >
              Copy to {selectedAreasToCopy.length} Areas
            </Button>
          </View>
        </View>
        </Modal>
      </Portal>

      {/* Bulk ETA Operations Modal */}
      <Portal>
        <Modal
          visible={showBulkETAModal}
          onDismiss={() => setShowBulkETAModal(false)}
          contentContainerStyle={dynamicStyles.modal}
        >
        <View style={dynamicStyles.modalContent}>
          <Text style={dynamicStyles.modalTitle}>
            {bulkETAAction === 'add' ? 'Add 1 Hour to All ETAs' : 'Deduct 1 Hour from All ETAs'}
          </Text>
          <Text style={dynamicStyles.modalSubtitle}>
            This will {bulkETAAction === 'add' ? 'add' : 'deduct'} 1 hour to all existing ETAs. Are you sure?
          </Text>
          
          <ScrollView style={dynamicStyles.etaPreview} showsVerticalScrollIndicator={false}>
            <Text style={dynamicStyles.previewTitle}>Preview of changes:</Text>
            {Object.entries(areaETAs).map(([areaId, etaString]) => {
              const area = userAreas.find(a => a.areaId === Number(areaId));
              let newETA;
              
              if (etaString.includes('-')) {
                const [startStr, endStr] = etaString.split('-');
                const startTime = parseTimeString(startStr.trim());
                const endTime = parseTimeString(endStr.trim());
                const newStart = bulkETAAction === 'add' ? addHourToTime(startTime) : deductHourFromTime(startTime);
                const newEnd = bulkETAAction === 'add' ? addHourToTime(endTime) : deductHourFromTime(endTime);
                newETA = `${formatTimeFromDate(newStart)}-${formatTimeFromDate(newEnd)}`;
              } else {
                const time = parseTimeString(etaString.trim());
                const newTime = bulkETAAction === 'add' ? addHourToTime(time) : deductHourFromTime(time);
                newETA = formatTimeFromDate(newTime);
              }
              
              return (
                <Text key={areaId} style={dynamicStyles.previewItem}>
                  {area ? areasAPI.getAreaName(area, 'ar') : `Area ${areaId}`}: {etaString} → {newETA}
                </Text>
              );
            })}
          </ScrollView>

          <View style={dynamicStyles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowBulkETAModal(false)}
              style={dynamicStyles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmBulkETA}
              loading={etaSaving}
              disabled={etaSaving}
              style={[dynamicStyles.modalButton, dynamicStyles.confirmButton]}
            >
              {bulkETAAction === 'add' ? 'Add Hour to All' : 'Deduct Hour from All'}
            </Button>
          </View>
        </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  addButton: {
    height: 36,
    minWidth: 80,
    alignSelf: 'flex-end',
  },
  sessionsButton: {
    marginRight: 8,
    borderColor: '#667eea',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
    flex: 1,
    minWidth: '40%',
  },
  divider: {
    marginVertical: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#25D366',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  noDataText: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginVertical: 20,
  },
  areaItem: {
    marginVertical: 4,
  },
  areaItemWithETA: {
    backgroundColor: theme.colors.primaryContainer,
  },
  etaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  etaButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bulk Operations Styles
  bulkOperationsContainer: {
    marginVertical: 12,
  },
  bulkOperationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  bulkButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  bulkButton: {
    flex: 1,
    minWidth: 120,
  },
  addHourButton: {
    borderColor: '#25D366',
  },
  deductHourButton: {
    borderColor: '#FF3B30',
  },
  // Modal Styles
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
  },
  // Area Selection Styles
  areaButtonsContainer: {
    maxHeight: 200,
    marginVertical: 12,
  },
  areaButton: {
    marginVertical: 4,
    borderColor: theme.colors.outline,
  },
  selectedAreaButton: {
    backgroundColor: theme.colors.primary,
  },
  areaButtonLabel: {
    fontSize: 12,
  },
  // ETA Preview Styles
  etaPreview: {
    maxHeight: 200,
    marginVertical: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  previewItem: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  // WhatsApp Session Selector Styles
  refreshButton: {
    borderColor: '#007AFF',
  },
  noSessionsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSessionsText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  noSessionsHelp: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sessionsList: {
    gap: 8,
  },
  sessionButton: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  selectedSessionButton: {
    borderColor: '#25D366',
    backgroundColor: theme.colors.primaryContainer,
    borderWidth: 2,
  },
  sessionButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  selectedSessionName: {
    color: '#25D366',
  },
  sessionId: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedSessionInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
  },
  selectedSessionLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  selectedSessionStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  templatesContainer: {
    marginVertical: 8,
  },
  templateCard: {
    width: 200,
    marginRight: 12,
  },
  selectedTemplateCard: {
    borderColor: '#25D366',
    borderWidth: 2,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  templateText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
  templateFlags: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  flagChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  messageInput: {
    marginBottom: 16,
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  stopButton: {
    backgroundColor: '#FF3B30', // Red color for stop button
  },
  previewCard: {
    marginBottom: 12,
  },
  multiLanguageCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    backgroundColor: '#fff5f2',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewCustomer: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
    flex: 1,
  },
  languageBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  languageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewArea: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  previewMessage: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
  multiLanguageNote: {
    fontSize: 11,
    color: '#FF6B35',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 16,
    textAlign: 'center',
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 16,
  },
  timePickerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  etaFormatSection: {
    marginBottom: 20,
  },
  etaFormatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  etaFormatOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  etaFormatOption: {
    flex: 1,
    padding: 12,
    borderWidth: 2,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
  },
  etaFormatOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  etaFormatOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
  },
  etaFormatOptionTextSelected: {
    color: '#007AFF',
  },
  timeSelectionSection: {
    marginBottom: 20,
  },
  timeSelectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  rangeEndSection: {
    marginBottom: 20,
  },
  rangeEndTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  etaPreviewSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  etaPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  etaPreviewText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#25D366',
    borderRadius: 5,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  resultsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  // Speed selection styles
  speedSection: {
    marginBottom: 16,
  },
  speedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  speedOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  speedOption: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    alignItems: 'center',
  },
  speedOptionSelected: {
    borderColor: '#25D366',
    backgroundColor: '#f0f9f0',
  },
  speedOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  speedOptionLabelSelected: {
    color: '#25D366',
  },
  speedOptionDescription: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  speedOptionDescriptionSelected: {
    color: '#25D366',
  },
  // Background sending styles
  backgroundSection: {
    marginBottom: 16,
  },
  backgroundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backgroundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  backgroundToggle: {
    width: 50,
    height: 30,
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  backgroundToggleActive: {
    backgroundColor: '#25D366',
  },
  backgroundToggleThumb: {
    width: 26,
    height: 26,
    backgroundColor: '#fff',
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  backgroundToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  backgroundDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  backgroundNote: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Connection status styles
  connectionSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
  },
  connectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectionStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Template Preview Styles
  templatePreviewContainer: {
    marginBottom: 16,
  },
  templatePreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  templatePreviewContent: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
    marginBottom: 12,
  },
  templatePreviewText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  templatePreviewNote: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noTemplateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noTemplateText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    fontWeight: '600',
  },
  noTemplateHelp: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default EnhancedMessageScreen; 