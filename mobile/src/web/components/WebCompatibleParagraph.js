import React from 'react';
import { Platform, Text } from 'react-native';
import { Paragraph as PaperParagraph } from 'react-native-paper';

// Web-compatible paragraph component
const WebCompatibleParagraph = ({ 
  children, 
  style,
  ...props 
}) => {
  // If we're on web, use a custom paragraph implementation
  if (Platform.OS === 'web') {
    const paragraphStyle = {
      fontSize: 16,
      color: '#666666',
      lineHeight: 24,
      marginBottom: 8,
      ...style,
    };

    return (
      <Text style={paragraphStyle} {...props}>
        {children}
      </Text>
    );
  }

  // For mobile platforms, use the native Paper Paragraph
  return (
    <PaperParagraph style={style} {...props}>
      {children}
    </PaperParagraph>
  );
};

export default WebCompatibleParagraph;
