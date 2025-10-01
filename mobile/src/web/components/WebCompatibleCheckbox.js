import React from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { Checkbox as PaperCheckbox } from 'react-native-paper';

// Web-compatible checkbox component
const WebCompatibleCheckbox = ({ 
  status = 'unchecked',
  onPress,
  color = '#25D366',
  style,
  disabled = false,
  ...props 
}) => {
  // If we're on web, use a custom checkbox implementation
  if (Platform.OS === 'web') {
    const isChecked = status === 'checked';
    
    const checkboxStyle = {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: isChecked ? color : '#cccccc',
      borderRadius: 3,
      backgroundColor: isChecked ? color : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      outline: 'none',
      transition: 'all 0.2s ease',
      ...style,
    };

    const checkmarkStyle = {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: 'bold',
    };

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && onPress) {
        onPress();
      }
    };

    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        style={checkboxStyle}
        {...props}
      >
        {isChecked && (
          <span style={checkmarkStyle}>✓</span>
        )}
      </button>
    );
  }

  // For mobile platforms, use the native Paper Checkbox
  return (
    <PaperCheckbox
      status={status}
      onPress={onPress}
      color={color}
      style={style}
      disabled={disabled}
      {...props}
    />
  );
};

export default WebCompatibleCheckbox;