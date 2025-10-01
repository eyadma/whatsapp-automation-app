import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';

const WebAppPreviewScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [loading, setLoading] = useState(false);

  const handleStartApp = () => {
    // Navigate to the main app
    navigation.navigate('MainApp');
  };

  const handleViewDemo = () => {
    Alert.alert('Demo', 'This would show a demo of the app functionality');
  };

  const handleLearnMore = () => {
    Alert.alert('Learn More', 'This would show more information about the app');
  };

  const dynamicStyles = createStyles();

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          WhatsApp Manager
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Professional messaging platform for businesses
        </WebCompatibleParagraph>
      </View>

      {/* Hero Section */}
      <WebCompatibleCard style={dynamicStyles.heroCard}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.heroContent}>
            <Text style={dynamicStyles.heroTitle}>
              Streamline Your WhatsApp Messaging
            </Text>
            <WebCompatibleParagraph style={dynamicStyles.heroDescription}>
              Manage multiple WhatsApp accounts, send bulk messages, and track performance 
              with our comprehensive messaging platform designed for businesses.
            </WebCompatibleParagraph>
            <View style={dynamicStyles.heroActions}>
              <WebCompatibleButton
                mode="contained"
                onPress={handleStartApp}
                style={dynamicStyles.heroButton}
              >
                Get Started
              </WebCompatibleButton>
              <WebCompatibleButton
                mode="outlined"
                onPress={handleViewDemo}
                style={dynamicStyles.heroButton}
              >
                View Demo
              </WebCompatibleButton>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Features Section */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Key Features
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Everything you need to manage your WhatsApp messaging efficiently
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.featuresGrid}>
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>📱</Text>
              <Text style={dynamicStyles.featureTitle}>Multiple Sessions</Text>
              <Text style={dynamicStyles.featureDescription}>
                Manage multiple WhatsApp accounts from a single dashboard
              </Text>
            </View>
            
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>📊</Text>
              <Text style={dynamicStyles.featureTitle}>Analytics</Text>
              <Text style={dynamicStyles.featureDescription}>
                Track message delivery, success rates, and performance metrics
              </Text>
            </View>
            
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>👥</Text>
              <Text style={dynamicStyles.featureTitle}>Customer Management</Text>
              <Text style={dynamicStyles.featureDescription}>
                Organize and manage your customer database with ease
              </Text>
            </View>
            
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>📝</Text>
              <Text style={dynamicStyles.featureTitle}>Message Templates</Text>
              <Text style={dynamicStyles.featureDescription}>
                Create and manage message templates for consistent communication
              </Text>
            </View>
            
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>🌍</Text>
              <Text style={dynamicStyles.featureTitle}>Multi-Language</Text>
              <Text style={dynamicStyles.featureDescription}>
                Support for English, Arabic, and Hebrew languages
              </Text>
            </View>
            
            <View style={dynamicStyles.featureItem}>
              <Text style={dynamicStyles.featureIcon}>🔒</Text>
              <Text style={dynamicStyles.featureTitle}>Secure</Text>
              <Text style={dynamicStyles.featureDescription}>
                Enterprise-grade security and data protection
              </Text>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* How It Works Section */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            How It Works
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Get started with WhatsApp Manager in just a few simple steps
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.stepsContainer}>
            <View style={dynamicStyles.stepItem}>
              <View style={dynamicStyles.stepNumber}>
                <Text style={dynamicStyles.stepNumberText}>1</Text>
              </View>
              <View style={dynamicStyles.stepContent}>
                <Text style={dynamicStyles.stepTitle}>Create Your Account</Text>
                <Text style={dynamicStyles.stepDescription}>
                  Sign up and set up your admin account to get started
                </Text>
              </View>
            </View>
            
            <View style={dynamicStyles.stepItem}>
              <View style={dynamicStyles.stepNumber}>
                <Text style={dynamicStyles.stepNumberText}>2</Text>
              </View>
              <View style={dynamicStyles.stepContent}>
                <Text style={dynamicStyles.stepTitle}>Connect WhatsApp</Text>
                <Text style={dynamicStyles.stepDescription}>
                  Link your WhatsApp accounts using QR code scanning
                </Text>
              </View>
            </View>
            
            <View style={dynamicStyles.stepItem}>
              <View style={dynamicStyles.stepNumber}>
                <Text style={dynamicStyles.stepNumberText}>3</Text>
              </View>
              <View style={dynamicStyles.stepContent}>
                <Text style={dynamicStyles.stepTitle}>Import Customers</Text>
                <Text style={dynamicStyles.stepDescription}>
                  Add your customer database and organize by areas
                </Text>
              </View>
            </View>
            
            <View style={dynamicStyles.stepItem}>
              <View style={dynamicStyles.stepNumber}>
                <Text style={dynamicStyles.stepNumberText}>4</Text>
              </View>
              <View style={dynamicStyles.stepContent}>
                <Text style={dynamicStyles.stepTitle}>Start Messaging</Text>
                <Text style={dynamicStyles.stepDescription}>
                  Send personalized messages and track performance
                </Text>
              </View>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Benefits Section */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Why Choose WhatsApp Manager?
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Discover the benefits of using our professional messaging platform
          </WebCompatibleParagraph>
          
          <WebCompatibleList>
            <WebCompatibleList.Item
              title="Increased Efficiency"
              description="Automate your messaging workflow and save time"
            />
            <WebCompatibleList.Item
              title="Better Organization"
              description="Keep track of all your customer interactions in one place"
            />
            <WebCompatibleList.Item
              title="Professional Communication"
              description="Maintain consistent and professional messaging standards"
            />
            <WebCompatibleList.Item
              title="Real-time Analytics"
              description="Monitor your messaging performance with detailed insights"
            />
            <WebCompatibleList.Item
              title="Multi-language Support"
              description="Communicate with customers in their preferred language"
            />
            <WebCompatibleList.Item
              title="Scalable Solution"
              description="Grow your business with a platform that scales with you"
            />
          </WebCompatibleList>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Call to Action */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.ctaContent}>
            <WebCompatibleTitle style={dynamicStyles.ctaTitle}>
              Ready to Get Started?
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.ctaDescription}>
              Join thousands of businesses already using WhatsApp Manager to streamline their messaging
            </WebCompatibleParagraph>
            <View style={dynamicStyles.ctaActions}>
              <WebCompatibleButton
                mode="contained"
                onPress={handleStartApp}
                style={dynamicStyles.ctaButton}
              >
                Start Free Trial
              </WebCompatibleButton>
              <WebCompatibleButton
                mode="outlined"
                onPress={handleLearnMore}
                style={dynamicStyles.ctaButton}
              >
                Learn More
              </WebCompatibleButton>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Footer */}
      <View style={dynamicStyles.footer}>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          WhatsApp Manager - Professional messaging platform
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Version 1.3.0 - Web Platform
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          © 2024 All rights reserved
        </WebCompatibleParagraph>
      </View>
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
  },
  heroCard: {
    marginBottom: 32,
    backgroundColor: '#25D366',
  },
  heroContent: {
    textAlign: 'center',
    padding: 32,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroDescription: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  heroButton: {
    minWidth: 150,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'center',
  },
  featureItem: {
    width: 300,
    textAlign: 'center',
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  stepsContainer: {
    gap: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  ctaContent: {
    textAlign: 'center',
    padding: 32,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
  },
  ctaDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaActions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  ctaButton: {
    minWidth: 150,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default WebAppPreviewScreen;
