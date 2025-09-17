import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import ContactsPermission from './ContactsPermission';
import contactsService from '../services/contactsService';

const AppPreview = () => {
  const [showContactsPermission, setShowContactsPermission] = useState(false);
  const [contactsCount, setContactsCount] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkInitialPermission();
  }, []);

  const checkInitialPermission = async () => {
    const hasContactsPermission = await contactsService.checkPermission();
    setHasPermission(hasContactsPermission);
    
    if (hasContactsPermission) {
      try {
        const contacts = await contactsService.getContactsForWhatsApp();
        setContactsCount(contacts.length);
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    }
  };

  const handlePermissionGranted = async () => {
    setShowContactsPermission(false);
    setHasPermission(true);
    
    try {
      const contacts = await contactsService.getContactsForWhatsApp();
      setContactsCount(contacts.length);
      
      Alert.alert(
        'Success!',
        `Found ${contacts.length} contacts with phone numbers. You can now use WhatsApp messaging features.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error loading contacts after permission:', error);
    }
  };

  const handlePermissionDenied = () => {
    setShowContactsPermission(false);
    Alert.alert(
      'Permission Skipped',
      'You can enable contacts access later in Settings to use all features.',
      [{ text: 'OK' }]
    );
  };

  const requestContactsPermission = () => {
    setShowContactsPermission(true);
  };

  const FeatureCard = ({ icon, title, description, color = '#25D366' }) => (
    <View style={styles.featureCard}>
      <View style={[styles.featureIcon, { backgroundColor: color }]}>
        <MaterialIcons name={icon} size={24} color="white" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );

  if (showContactsPermission) {
    return (
      <ContactsPermission
        onPermissionGranted={handlePermissionGranted}
        onPermissionDenied={handlePermissionDenied}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.appIconContainer}>
            <Image 
              source={require('../../assets/images/icon.png')} 
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.appName}>WhatsApp Automation</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              Professional WhatsApp messaging automation with cloud deployment
            </Text>
          </View>
        </View>
      </View>

      {/* Status Cards */}
      <View style={styles.statusContainer}>
        <View style={styles.statusCard}>
          <Ionicons name="cloud" size={24} color="#25D366" />
          <Text style={styles.statusTitle}>Cloud Status</Text>
          <Text style={styles.statusValue}>Connected</Text>
          <Text style={styles.statusSubtext}>Railway Production</Text>
        </View>
        
        <View style={styles.statusCard}>
          <MaterialIcons name="contacts" size={24} color={hasPermission ? "#25D366" : "#ccc"} />
          <Text style={styles.statusTitle}>Contacts</Text>
          <Text style={styles.statusValue}>
            {hasPermission ? `${contactsCount} contacts` : 'Not accessible'}
          </Text>
          <Text style={styles.statusSubtext}>
            {hasPermission ? 'Ready for messaging' : 'Permission required'}
          </Text>
        </View>
      </View>

      {/* Permission Section */}
      {!hasPermission && (
        <View style={styles.permissionSection}>
          <Text style={styles.sectionTitle}>Enable Contacts Access</Text>
          <Text style={styles.sectionDescription}>
            Grant access to your contacts to use WhatsApp messaging features
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestContactsPermission}>
            <MaterialIcons name="contacts" size={20} color="white" />
            <Text style={styles.permissionButtonText}>Grant Contacts Access</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>App Features</Text>
        
        <FeatureCard
          icon="message"
          title="WhatsApp Messaging"
          description="Send individual and bulk messages through WhatsApp"
        />
        
        <FeatureCard
          icon="location-on"
          title="Location Messages"
          description="Receive and process location messages automatically"
        />
        
        <FeatureCard
          icon="people"
          title="Customer Management"
          description="Manage customer information and messaging history"
        />
        
        <FeatureCard
          icon="cloud"
          title="Cloud Deployment"
          description="Always-available server with Railway cloud hosting"
        />
        
        <FeatureCard
          icon="security"
          title="Secure & Reliable"
          description="Professional infrastructure with health monitoring"
        />
        
        <FeatureCard
          icon="sync"
          title="Real-time Sync"
          description="Automatic synchronization with Supabase database"
        />
      </View>

      {/* Technical Info */}
      <View style={styles.techSection}>
        <Text style={styles.sectionTitle}>Technical Information</Text>
        
        <View style={styles.techCard}>
          <Text style={styles.techLabel}>Server URL:</Text>
          <Text style={styles.techValue}>whatsapp-automation-app-production.up.railway.app</Text>
        </View>
        
        <View style={styles.techCard}>
          <Text style={styles.techLabel}>API Endpoints:</Text>
          <Text style={styles.techValue}>26 endpoints available</Text>
        </View>
        
        <View style={styles.techCard}>
          <Text style={styles.techLabel}>Node.js Version:</Text>
          <Text style={styles.techValue}>20.x (Production Ready)</Text>
        </View>
        
        <View style={styles.techCard}>
          <Text style={styles.techLabel}>Database:</Text>
          <Text style={styles.techValue}>Supabase (Cloud)</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built with React Native & Expo
        </Text>
        <Text style={styles.footerText}>
          Deployed on Railway Cloud Platform
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#25D366',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appIcon: {
    width: 60,
    height: 60,
  },
  headerText: {
    flex: 1,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statusCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  permissionSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  featuresSection: {
    padding: 20,
  },
  featureCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  techSection: {
    padding: 20,
  },
  techCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  techLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  techValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default AppPreview;
