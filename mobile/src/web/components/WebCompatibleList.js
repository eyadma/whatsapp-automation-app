import React from 'react';
import { Platform, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { List as PaperList } from 'react-native-paper';

// Web-compatible list component
const WebCompatibleList = ({ 
  children, 
  style,
  ...props 
}) => {
  // If we're on web, use a custom list implementation
  if (Platform.OS === 'web') {
    const listStyle = {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      margin: 8,
      ...style,
    };

    return (
      <View style={listStyle} {...props}>
        {children}
      </View>
    );
  }

  // For mobile platforms, use the native Paper List
  return (
    <PaperList.Section style={style} {...props}>
      {children}
    </PaperList.Section>
  );
};

// Create compatible Item component
WebCompatibleList.Item = ({ 
  title,
  description,
  left,
  right,
  onPress,
  style,
  titleStyle,
  descriptionStyle,
  ...props 
}) => {
  if (Platform.OS === 'web') {
    const itemStyle = {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
      flexDirection: 'row',
      alignItems: 'center',
      cursor: onPress ? 'pointer' : 'default',
      ...style,
    };

    const titleTextStyle = {
      fontSize: 16,
      fontWeight: '500',
      color: '#333333',
      marginBottom: 4,
      ...titleStyle,
    };

    const descriptionTextStyle = {
      fontSize: 14,
      color: '#666666',
      ...descriptionStyle,
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        style={itemStyle}
        {...props}
      >
        {left && (
          <View style={{ marginRight: 16 }}>
            {left}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={titleTextStyle}>
            {title}
          </Text>
          {description && (
            <Text style={descriptionTextStyle}>
              {description}
            </Text>
          )}
        </View>
        {right && (
          <View style={{ marginLeft: 16 }}>
            {right}
          </View>
        )}
      </TouchableOpacity>
    );
  }
  
  return (
    <PaperList.Item
      title={title}
      description={description}
      left={left}
      right={right}
      onPress={onPress}
      style={style}
      titleStyle={titleStyle}
      descriptionStyle={descriptionStyle}
      {...props}
    />
  );
};

// Create compatible Section component
WebCompatibleList.Section = ({ 
  children, 
  title,
  style,
  titleStyle,
  ...props 
}) => {
  if (Platform.OS === 'web') {
    const sectionStyle = {
      marginBottom: 16,
      ...style,
    };

    const sectionTitleStyle = {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333333',
      marginBottom: 8,
      paddingHorizontal: 16,
      ...titleStyle,
    };

    return (
      <View style={sectionStyle} {...props}>
        {title && (
          <Text style={sectionTitleStyle}>
            {title}
          </Text>
        )}
        {children}
      </View>
    );
  }
  
  return (
    <PaperList.Section
      title={title}
      style={style}
      titleStyle={titleStyle}
      {...props}
    >
      {children}
    </PaperList.Section>
  );
};

export default WebCompatibleList;
