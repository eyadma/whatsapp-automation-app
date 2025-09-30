import React, { useContext } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { AppContext } from '../../context/AppContext';

const MinimalSettingsScreen = () => {
  const { t, theme } = useContext(AppContext);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          marginBottom: 20,
          color: theme === 'dark' ? '#ffffff' : '#000000'
        }}>
          {t("settings") || "Settings"}
        </Text>
        
        <Text style={{ 
          fontSize: 16, 
          marginBottom: 10,
          color: theme === 'dark' ? '#ffffff' : '#000000'
        }}>
          This is a minimal settings screen with no StyleSheet objects.
        </Text>
        
        <Text style={{ 
          fontSize: 14, 
          color: theme === 'dark' ? '#cccccc' : '#666666'
        }}>
          All styles are inline to avoid CSSStyleDeclaration errors.
        </Text>
      </View>
    </ScrollView>
  );
};

export default MinimalSettingsScreen;
