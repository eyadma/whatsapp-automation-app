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
  // If we're on web, use a custom HTML button implementation
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
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      outline: 'none',
      transition: 'all 0.2s ease',
      ...(isContained && {
        backgroundColor: '#25D366',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }),
      ...(isOutlined && {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderStyle: 'solid',
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

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !loading && onPress) {
        onPress();
      }
    };

    const handleMouseEnter = (e) => {
      if (!disabled && !loading) {
        e.target.style.opacity = '0.8';
        if (isContained) {
          e.target.style.backgroundColor = '#1ea952';
        } else {
          e.target.style.backgroundColor = '#f0f0f0';
        }
      }
    };

    const handleMouseLeave = (e) => {
      if (!disabled && !loading) {
        e.target.style.opacity = '1';
        if (isContained) {
          e.target.style.backgroundColor = '#25D366';
        } else {
          e.target.style.backgroundColor = 'transparent';
        }
      }
    };

    return (
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled || loading}
        style={webButtonStyle}
        {...props}
      >
        {icon && (
          <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
        <span style={webTextStyle}>
          {loading ? 'Loading...' : children}
        </span>
      </button>
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