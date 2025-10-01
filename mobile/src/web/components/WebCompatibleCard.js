import React from 'react';
import { Platform, View, Text } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';

// Web-compatible card component
const WebCompatibleCard = ({ 
  children, 
  style,
  elevation = 2,
  ...props 
}) => {
  // If we're on web, use a custom card implementation
  if (Platform.OS === 'web') {
    const webCardStyle = {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      padding: 16,
      margin: 8,
      boxShadow: `0 ${elevation}px ${elevation * 2}px rgba(0, 0, 0, 0.1)`,
      border: '1px solid #e0e0e0',
      ...style,
    };

    return (
      <View style={webCardStyle} {...props}>
        {children}
      </View>
    );
  }

  // For mobile platforms, use the native Paper Card
  return (
    <PaperCard style={style} elevation={elevation} {...props}>
      {children}
    </PaperCard>
  );
};

// Create compatible Content component
WebCompatibleCard.Content = ({ children, style, ...props }) => {
  if (Platform.OS === 'web') {
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  }
  
  return (
    <PaperCard.Content style={style} {...props}>
      {children}
    </PaperCard.Content>
  );
};

// Create compatible Title component
WebCompatibleCard.Title = ({ children, style, ...props }) => {
  if (Platform.OS === 'web') {
    const titleStyle = {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#333333',
      marginBottom: 8,
      ...style,
    };
    
    return (
      <Text style={titleStyle} {...props}>
        {children}
      </Text>
    );
  }
  
  return (
    <PaperCard.Title style={style} {...props}>
      {children}
    </PaperCard.Title>
  );
};

export default WebCompatibleCard;
