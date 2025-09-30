import React from 'react';
import { Platform, TouchableOpacity, Text, View } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

// Web-compatible button component
const WebCompatibleButton = ({ 
  onPress, 
  children, 
  mode = 'contained',
  disabled = false,
  loading = false,
  style,
  labelStyle,
  contentStyle,
  icon,
  ...props 
}) => {
  // If we're on web, use a custom TouchableOpacity implementation
  if (Platform.OS === 'web') {
    const isContained = mode === 'contained';
    const isOutlined = mode === 'outlined';
    
    const webButtonStyle = {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      minHeight: 48,
      opacity: disabled ? 0.6 : 1,
      ...(isContained && {
        backgroundColor: '#25D366',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }),
      ...(isOutlined && {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#25D366',
      }),
      ...style,
    };

    const webTextStyle = {
      color: isContained ? '#FFFFFF' : '#25D366',
      fontSize: 16,
      fontWeight: '600',
      ...labelStyle,
    };

    return (
      <TouchableOpacity
        onPress={disabled || loading ? undefined : onPress}
        style={webButtonStyle}
        disabled={disabled || loading}
        {...props}
      >
        {icon && (
          <View style={{ marginRight: 8 }}>
            {icon}
          </View>
        )}
        <Text style={webTextStyle}>
          {loading ? 'Loading...' : children}
        </Text>
      </TouchableOpacity>
    );
  }

  // For mobile platforms, use the native Paper Button
  return (
    <PaperButton
      onPress={onPress}
      mode={mode}
      disabled={disabled}
      loading={loading}
      style={style}
      labelStyle={labelStyle}
      contentStyle={contentStyle}
      icon={icon}
      {...props}
    >
      {children}
    </PaperButton>
  );
};

export default WebCompatibleButton;
