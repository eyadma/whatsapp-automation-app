import React from 'react';
import { Platform, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Web-compatible picker component
const WebCompatiblePicker = ({ 
  selectedValue, 
  onValueChange, 
  children, 
  style,
  ...props 
}) => {
  // If we're on web, use native HTML select
  if (Platform.OS === 'web') {
    // Convert children to options
    const options = React.Children.map(children, (child) => {
      if (child && child.props) {
        return {
          value: child.props.value,
          label: child.props.label || child.props.value
        };
      }
      return null;
    }).filter(Boolean);

    return (
      <View style={style}>
        <select
          value={selectedValue || ''}
          onChange={(e) => onValueChange(e.target.value === '' ? null : e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px',
            backgroundColor: 'white',
            minHeight: '50px',
            ...style
          }}
          {...props}
        >
          {options.map((option, index) => (
            <option key={index} value={option.value || ''}>
              {option.label}
            </option>
          ))}
        </select>
      </View>
    );
  }

  // For mobile platforms, use the native picker
  return (
    <Picker
      selectedValue={selectedValue}
      onValueChange={onValueChange}
      style={style}
      {...props}
    >
      {children}
    </Picker>
  );
};

// Create a compatible Item component
WebCompatiblePicker.Item = ({ label, value, ...props }) => {
  if (Platform.OS === 'web') {
    // For web, this is handled by the parent select component
    return null;
  }
  
  // For mobile, use the native Picker.Item
  return <Picker.Item label={label} value={value} {...props} />;
};

export default WebCompatiblePicker;
