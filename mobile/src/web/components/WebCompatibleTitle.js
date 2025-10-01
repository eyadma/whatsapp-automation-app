import React from 'react';
import { Platform, Text } from 'react-native';
import { Title as PaperTitle } from 'react-native-paper';

// Web-compatible title component
const WebCompatibleTitle = ({ 
  children, 
  style,
  ...props 
}) => {
  // If we're on web, use a custom title implementation
  if (Platform.OS === 'web') {
    const titleStyle = {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333333',
      marginBottom: 8,
      lineHeight: 32,
      ...style,
    };

    return (
      <Text style={titleStyle} {...props}>
        {children}
      </Text>
    );
  }

  // For mobile platforms, use the native Paper Title
  return (
    <PaperTitle style={style} {...props}>
      {children}
    </PaperTitle>
  );
};

export default WebCompatibleTitle;
