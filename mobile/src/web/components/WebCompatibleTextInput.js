import React from 'react';
import { Platform, View, Text, TextInput as RNTextInput } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';

// Web-compatible text input component
const WebCompatibleTextInput = ({ 
  label,
  value,
  onChangeText,
  mode = 'outlined',
  style,
  labelStyle,
  left,
  right,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  placeholder,
  ...props 
}) => {
  // If we're on web, use a custom input implementation
  if (Platform.OS === 'web') {
    const isOutlined = mode === 'outlined';
    
    const containerStyle = {
      marginBottom: 16,
      ...style,
    };

    const labelTextStyle = {
      fontSize: 14,
      color: '#666666',
      marginBottom: 4,
      fontWeight: '500',
      ...labelStyle,
    };

    const inputStyle = {
      width: '100%',
      padding: 12,
      fontSize: 16,
      borderWidth: isOutlined ? 1 : 0,
      borderColor: isOutlined ? '#cccccc' : 'transparent',
      borderRadius: isOutlined ? 4 : 0,
      backgroundColor: isOutlined ? 'transparent' : '#f5f5f5',
      minHeight: multiline ? numberOfLines * 24 + 24 : 48,
      textAlignVertical: multiline ? 'top' : 'center',
      ...(Platform.OS === 'web' && {
        outline: 'none',
        borderBottomWidth: !isOutlined ? 1 : 0,
        borderBottomColor: !isOutlined ? '#cccccc' : 'transparent',
      }),
    };

    const iconContainerStyle = {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 1,
    };

    const rightIconContainerStyle = {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 1,
    };

    return (
      <View style={containerStyle}>
        {label && (
          <Text style={labelTextStyle}>
            {label}
          </Text>
        )}
        <View style={{ position: 'relative' }}>
          {left && (
            <View style={iconContainerStyle}>
              {left}
            </View>
          )}
          <RNTextInput
            value={value}
            onChangeText={onChangeText}
            style={[
              inputStyle,
              left && { paddingLeft: 48 },
              right && { paddingRight: 48 },
            ]}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            numberOfLines={numberOfLines}
            placeholder={placeholder}
            {...props}
          />
          {right && (
            <View style={rightIconContainerStyle}>
              {right}
            </View>
          )}
        </View>
      </View>
    );
  }

  // For mobile platforms, use the native Paper TextInput
  return (
    <PaperTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      mode={mode}
      style={style}
      labelStyle={labelStyle}
      left={left}
      right={right}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      numberOfLines={numberOfLines}
      placeholder={placeholder}
      {...props}
    />
  );
};

// Create compatible Icon component
WebCompatibleTextInput.Icon = ({ icon, onPress, ...props }) => {
  if (Platform.OS === 'web') {
    // For web, we'll use a simple text representation or icon
    return (
      <Text 
        style={{ 
          fontSize: 20, 
          color: '#666666',
          cursor: onPress ? 'pointer' : 'default',
        }}
        onPress={onPress}
        {...props}
      >
        {icon === 'email' ? '✉️' : 
         icon === 'lock' ? '🔒' : 
         icon === 'eye' ? '👁️' : 
         icon === 'eye-off' ? '🙈' : 
         icon === 'phone' ? '📞' : 
         icon === 'account' ? '👤' : 
         icon || '📝'}
      </Text>
    );
  }
  
  return (
    <PaperTextInput.Icon icon={icon} onPress={onPress} {...props} />
  );
};

export default WebCompatibleTextInput;
